import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { productsService } from "../../services/productsService"
import { customersService } from "../../services/customersService"
import { salesService } from "../../services/salesService"
import { formatCurrency } from "../../utils/formatters"
import toast from "react-hot-toast"
import {
  Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle,
  User, MapPin, CreditCard, FileText, ChevronRight, ChevronLeft,
  Package, Phone, Smartphone, Info, Crosshair, Loader2,
} from "lucide-react"

// --- Constantes ----------------------------------------------------------------
const STEPS = [
  { id: 1, label: "Panier" },
  { id: 2, label: "Client" },
  { id: 3, label: "Livraison" },
  { id: 4, label: "Paiement" },
  { id: 5, label: "Résumé" },
]

// Logos SVG inline pour chaque mode de paiement - pas de dépendance externe,
// pas de droits d'image, rendu identique sur toutes les plateformes.
function PaymentLogo({ method, size = 50 }) {
  const logos = {
    cash: "/payments/cash.webp",
    card: "/payments/credit.avif",
    wave: "/payments/wave.webp",
    orange_money: "/payments/orange-money.webp",
    transfer: "/payments/bank.webp",
  }

  return (
    <img
      src={logos[method]}
      alt={method}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
      }}
      onError={(e) => {
        e.currentTarget.src = "/payments/cash.webp"
      }}
    />
  )
}

const PAYMENT_OPTIONS = [
  { key: "cash", label: "Espèces", description: "Paiement en Espèces", bg: "bg-green-50", hint: null, extraField: null },
  { key: "card", label: "Carte bancaire", description: "Visa, Mastercard, etc.", bg: "bg-blue-50", hint: null, extraField: null },
  { key: "wave", label: "Wave", description: "Paiement via Wave", bg: "bg-blue-50", hint: "Le client finalisera le paiement via son compte Wave. Assurez-vous que le numéro Wave du client est correct avant de valider la vente.", extraField: { placeholder: "Ex: 77 123 45 67", label: "Numéro Wave du client (optionnel)" } },
  { key: "orange_money", label: "Orange Money", description: "Paiement via Orange Money", bg: "bg-orange-50", hint: "Le client finalisera le paiement via son compte Orange Money.", extraField: { placeholder: "Ex: 77 123 45 67", label: "Numéro Orange Money du client (optionnel)" } },
  { key: "transfer", label: "Virement bancaire", description: "Paiement par virement", bg: "bg-gray-50", hint: "Vérifiez la réception du virement avant de valider la vente.", extraField: null },
]

// --- Stepper -------------------------------------------------------------------
function Stepper({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const isDone   = currentStep > step.id
        const isActive = currentStep === step.id
        const isLast   = idx === STEPS.length - 1
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all
                ${isDone    ? "bg-blue-600 border-blue-600 text-white" : ""}
                ${isActive  ? "bg-white border-blue-600 text-blue-600" : ""}
                ${!isDone && !isActive ? "bg-white border-gray-300 text-gray-400" : ""}
              `}>
                {isDone ? <CheckCircle size={16} /> : step.id}
              </div>
              <span className={`text-xs mt-1.5 font-medium whitespace-nowrap
                ${isActive ? "text-blue-600" : isDone ? "text-blue-500" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`w-16 sm:w-24 h-0.5 mb-5 mx-1 transition-all ${isDone ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- Panneau Résumé latéral ----------------------------------------------------
function SidePanel({ subtotal, discountAmount, deliveryFee, total, paymentMethod, selectedCustomer, deliveryAddress }) {
  const selectedPayment = PAYMENT_OPTIONS.find((p) => p.key === paymentMethod)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-6">
      <h3 className="font-bold text-base mb-4">Résumé de la vente</h3>
      <div className="space-y-2.5 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-500">Sous-total</span>
          <span className="font-semibold text-blue-600">{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Remise</span>
            <span className="font-semibold text-red-500">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Livraison</span>
            <span className="font-semibold text-gray-700">{formatCurrency(deliveryFee)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-3 mt-1">
          <span className="font-bold text-gray-900 text-base">Total</span>
          <span className="font-bold text-blue-700 text-base">{formatCurrency(total)}</span>
        </div>
      </div>

      {selectedPayment && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-blue-700">Mode de paiement</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Sélectionné</span>
          </div>
          <div className="flex items-center gap-2">
            <PaymentLogo method={selectedPayment.key} size={26} />
            <span className="font-semibold text-sm text-gray-800">{selectedPayment.label}</span>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Informations client</p>
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
            <User size={14} className="text-gray-400 flex-shrink-0" />
            <span className="font-medium">{selectedCustomer.name}</span>
          </div>
          {selectedCustomer.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={14} className="text-gray-400 flex-shrink-0" />
              <span>{selectedCustomer.phone}</span>
            </div>
          )}
        </div>
      )}

      {deliveryAddress && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adresse de livraison</p>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span>{deliveryAddress}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-center mt-2">
        <p className="text-xs font-semibold text-green-700 mb-1">Montant à payer</p>
        <p className="text-2xl font-bold text-green-700">{formatCurrency(total)}</p>
      </div>
    </div>
  )
}

// --- Étape 1 : Panier ---------------------------------------------------------
function ProductGridCard({ product, onAdd }) {
  const API = import.meta.env.VITE_API_URL || "http://localhost:8000"
  return (
    <button type="button" onClick={() => onAdd(product)}
      disabled={product.quantity < 1}
      className={`text-left border rounded-xl p-3 transition-all hover:border-blue-400 hover:shadow-sm ${product.quantity < 1 ? "opacity-50 cursor-not-allowed bg-gray-50" : "bg-white"}`}>
      <div className="w-full h-28 bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
        {product.image
          ? <img
    src={
      product.image
        ? (product.image.startsWith("http")
            ? product.image
            : `${API}${product.image}`)
        : "/images/no-product.png"
    }
    alt={product.name}
    className="h-full w-full object-cover"
    onError={(e) => {
      e.currentTarget.src = "/images/no-product.png"
    }}
  />

          : <Package size={28} className="text-gray-300" />}
      </div>
      <p className="font-semibold text-xs text-gray-900 truncate">{product.name}</p>
      <p className="text-xs text-gray-400 mt-0.5">{product.reference}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-sm font-bold text-blue-700">{formatCurrency(product.selling_price)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${product.quantity < 1 ? "bg-red-100 text-red-600" : product.quantity <= product.min_stock ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
          {product.quantity < 1 ? "Rupture" : `Stock: ${product.quantity}`}
        </span>
      </div>
      {product.quantity > 0 && (
        <div className="mt-2 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
          <Plus size={12} /> Ajouter
        </div>
      )}
    </button>
  )
}

function StepPanier({ search, setSearch, products, allProducts, loadingProducts, cart, onAdd, onIncrease, onDecrease, onDelete }) {
  // Liste affichée : résultats de recherche si recherche active, sinon TOUS les produits
  const displayedProducts = search.trim().length >= 2 ? products : allProducts

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-bold text-base mb-4">Rechercher un produit</h2>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, référence ou code-barres..."
            className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* -- Tous les produits affichés en grille 3 colonnes avec image -- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base">
            {search.trim().length >= 2 ? `Résultats pour « ${search} »` : "Tous les produits"}
          </h2>
          {!loadingProducts && (
            <span className="text-xs text-gray-400">{displayedProducts.length} produit(s)</span>
          )}
        </div>

        {loadingProducts ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <Loader2 size={28} className="animate-spin mb-2" />
            <p className="text-sm">Chargement des produits...</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Package size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProducts.map((product) => (
              <ProductGridCard key={product.id} product={product} onAdd={onAdd} />
            ))}
          </div>
        )}
      </div>

      {/* -- Panier -- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-gray-700" />
            <h2 className="font-bold text-base">Panier</h2>
          </div>
          {cart.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)} article(s)
            </span>
          )}
        </div>
        {cart.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ShoppingCart size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Votre panier est vide</p>
            <p className="text-xs mt-1 opacity-60">Cliquez sur un produit ci-dessus pour l'ajouter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.product_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.reference}</p>
                  <p className="text-xs text-blue-600 font-medium mt-0.5">{formatCurrency(item.unit_price)} x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => onDecrease(item.product_id)}
                    className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                    <Minus size={12} />
                  </button>
                  <span className="w-7 text-center font-bold text-sm">{item.quantity}</span>
                  <button type="button" onClick={() => onIncrease(item.product_id)}
                    className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                    <Plus size={12} />
                  </button>
                </div>
                <div className="text-right min-w-20">
                  <p className="font-bold text-sm text-gray-900">{formatCurrency(item.unit_price * item.quantity)}</p>
                </div>
                <button type="button" onClick={() => onDelete(item.product_id)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Étape 2 : Client (avec géolocalisation) ----------------------------------
function StepClient({
  customers, customerId, setCustomerId,
  discountPercent, setDiscountPercent, notes, setNotes,
  customerLat, customerLng, customerLocationLabel,
  onLocateCustomer, locating, locationError,
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <User size={20} className="text-blue-600" />
          <h2 className="font-bold text-base">Informations client</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sélectionner un client</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">- Client anonyme -</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Remise globale (%)</label>
            <input type="number" min="0" max="100" value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Informations supplémentaires sur la vente..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* -- Géolocalisation pour la livraison -- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={20} className="text-blue-600" />
          <h2 className="font-bold text-base">Localiser le client</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Utilisez la position GPS actuelle pour faciliter la livraison à ce client.
        </p>

        <button type="button" onClick={onLocateCustomer} disabled={locating}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
            ${locating ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-2 border-blue-200"}`}>
          {locating
            ? <><Loader2 size={16} className="animate-spin" /> Localisation en cours...</>
            : <><Crosshair size={16} /> Localiser la position du client</>
          }
        </button>

        {locationError && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <Info size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{locationError}</p>
          </div>
        )}

        {customerLat && customerLng && !locating && (
          <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
            <CheckCircle size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-green-700">
              <p className="font-semibold">Position enregistrée</p>
              {customerLocationLabel && <p className="mt-0.5">{customerLocationLabel}</p>}
              <p className="mt-0.5 text-green-600 opacity-75">
                Lat: {customerLat.toFixed(5)} · Lng: {customerLng.toFixed(5)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Étape 3 : Livraison ------------------------------------------------------
function StepLivraison({ deliveryMode, setDeliveryMode, deliveryAddress, setDeliveryAddress, deliveryCity, setDeliveryCity, deliveryFee, setDeliveryFee, customerPhone, setCustomerPhone, customerLat, customerLng }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-5">
        <MapPin size={20} className="text-blue-600" />
        <h2 className="font-bold text-base">Mode de livraison</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {[
          { value: "pickup",   label: "Retrait en boutique",   desc: "Le client récupère sa commande en boutique",  icon: "🏪" },
          { value: "delivery", label: "Livraison à domicile",  desc: "La commande est livrée à l'adresse du client", icon: "🚚" },
        ].map((opt) => (
          <button key={opt.value} type="button" onClick={() => setDeliveryMode(opt.value)}
            className={`text-left border-2 rounded-xl p-4 transition-all ${deliveryMode === opt.value ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
            <div className="text-2xl mb-2">{opt.icon}</div>
            <p className={`font-semibold text-sm ${deliveryMode === opt.value ? "text-blue-700" : "text-gray-800"}`}>{opt.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
            {opt.value === "delivery" && customerLat && (
              <span className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle size={11} /> Position client disponible
              </span>
            )}
            {deliveryMode === opt.value && <span className="text-xs text-blue-500 font-medium mt-1 block">Sélectionné</span>}
          </button>
        ))}
      </div>
      {deliveryMode === "delivery" && (
        <div className="space-y-4 border-t border-gray-100 pt-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse de livraison *</label>
            <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Rue, quartier, numéro..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
              <input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)}
                placeholder="Ex: Thiès, Dakar..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Frais de livraison (FCFA)</label>
              <input type="number" min="0" value={deliveryFee} onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone du client</label>
            <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ex: 77 123 45 67"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {customerLat && customerLng && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              <MapPin size={14} className="flex-shrink-0" />
              <span>Position GPS du client enregistrée à l'étape précédente (Lat: {customerLat.toFixed(5)}, Lng: {customerLng.toFixed(5)})</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Étape 4 : Paiement (avec logo par méthode) -------------------------------
function StepPaiement({ paymentMethod, setPaymentMethod, extraPhoneNumber, setExtraPhoneNumber, total, amountPaid, setAmountPaid }) {
  const selected = PAYMENT_OPTIONS.find((p) => p.key === paymentMethod)
  const change = Math.max(0, amountPaid - total)
  const remaining = Math.max(0, total - amountPaid)
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard size={20} className="text-blue-600" />
          <h2 className="font-bold text-base">Mode de paiement</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">Choisissez le mode de paiement utilisé par le client</p>
        <div className="space-y-3">
          {PAYMENT_OPTIONS.map((opt) => {
            const isSelected = paymentMethod === opt.key
            return (
              <button key={opt.key} type="button" onClick={() => setPaymentMethod(opt.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${isSelected ? "border-blue-600 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-blue-600" : "border-gray-300"}`}>
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                </div>
                <div className={`w-12 h-12 rounded-xl ${opt.bg} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                  <PaymentLogo method={opt.key} size={30} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${isSelected ? "text-blue-700" : "text-gray-800"}`}>{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${isSelected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                  {isSelected ? "Sélectionné" : "Sélectionnable"}
                </span>
              </button>
            )
          })}
        </div>

        {selected?.hint && (
          <div className="mt-4 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">{selected.hint}</p>
          </div>
        )}

        {selected?.extraField && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{selected.extraField.label}</label>
            <div className="relative">
              <Smartphone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="tel" value={extraPhoneNumber} onChange={(e) => setExtraPhoneNumber(e.target.value)}
                placeholder={selected.extraField.placeholder}
                className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-gray-100 pt-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant reçu (FCFA)</label>
          <input type="number" min="0"
            value={amountPaid === 0 ? "" : amountPaid}
            onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
            placeholder={`Minimum : ${formatCurrency(total)}`}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {amountPaid > 0 && (
            <div className={`mt-3 rounded-xl p-4 ${amountPaid >= total ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${amountPaid >= total ? "text-green-700" : "text-orange-700"}`}>
                  {amountPaid >= total ? "Monnaie à rendre" : "Reste à payer"}
                </span>
                <span className={`font-bold text-base ${amountPaid >= total ? "text-green-700" : "text-orange-600"}`}>
                  {formatCurrency(amountPaid >= total ? change : remaining)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Étape 5 : Résumé ---------------------------------------------------------
function StepResume({ cart, subtotal, discountAmount, taxAmount, deliveryFee, total, paymentMethod, amountPaid, selectedCustomer, deliveryAddress, deliveryCity, notes, customerLat, customerLng }) {
  const selectedPayment = PAYMENT_OPTIONS.find((p) => p.key === paymentMethod)
  const change = Math.max(0, amountPaid - total)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-5">
        <FileText size={20} className="text-blue-600" />
        <h2 className="font-bold text-base">Résumé final de la vente</h2>
      </div>

      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Articles ({cart.reduce((s, i) => s + i.quantity, 0)})
        </p>
        <div className="space-y-2">
          {cart.map((item) => (
            <div key={item.product_id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
              <div>
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="text-gray-400 ml-2 text-xs">x {item.quantity}</span>
              </div>
              <span className="font-semibold text-gray-900">{formatCurrency(item.unit_price * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Sous-total HT</span><span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-red-500">
            <span>Remise</span><span className="font-medium">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {taxAmount > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>TVA</span><span className="font-medium">{formatCurrency(taxAmount)}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Livraison</span><span className="font-medium">{formatCurrency(deliveryFee)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
          <span>Total TTC</span><span className="text-blue-700">{formatCurrency(total)}</span>
        </div>
        {amountPaid > 0 && (
          <>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Montant reçu</span><span className="font-medium">{formatCurrency(amountPaid)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-green-700">
              <span>Monnaie à rendre</span><span>{formatCurrency(change)}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Client</p>
          <p className="text-gray-800">{selectedCustomer?.name || "Client anonyme"}</p>
          {selectedCustomer?.phone && <p className="text-gray-500">{selectedCustomer.phone}</p>}
          {customerLat && customerLng && (
            <p className="text-green-600 text-xs flex items-center gap-1 mt-1">
              <MapPin size={11} /> Position GPS enregistrée
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Paiement</p>
          <div className="flex items-center gap-2">
            <PaymentLogo method={selectedPayment?.key} size={20} />
            <p className="text-gray-800">{selectedPayment?.label}</p>
          </div>
        </div>
        {(deliveryAddress || deliveryCity) && (
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Livraison</p>
            <p className="text-gray-800">{[deliveryAddress, deliveryCity].filter(Boolean).join(", ")}</p>
          </div>
        )}
        {notes && (
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-gray-600 italic">{notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Écran succès --------------------------------------------------------------
function SuccessScreen({ sale, onNewSale, onViewHistory, onDownloadPdf }) {
  return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={48} className="text-emerald-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Vente enregistrée !</h2>
      <p className="text-gray-500 mb-2">
        Facture N° <span className="font-semibold text-gray-800">{sale.invoice_number}</span>
      </p>
      <p className="text-3xl font-bold text-blue-700 mb-1">{formatCurrency(sale.total_amount)}</p>
      <p className="text-emerald-600 text-sm mb-8">Bénéfice : {formatCurrency(sale.profit)}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onDownloadPdf}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
          Télécharger la facture PDF
        </button>
        <button onClick={onNewSale}
          className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
          Nouvelle vente
        </button>
        <button onClick={onViewHistory}
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
          Voir l'historique
        </button>
      </div>
    </div>
  )
}

// --- Composant principal -------------------------------------------------------
export default function NewSale() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Produits
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Panier
  const [cart, setCart] = useState([])

  // Client
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState("")
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState("")

  // Géolocalisation client
  const [customerLat, setCustomerLat] = useState(null)
  const [customerLng, setCustomerLng] = useState(null)
  const [customerLocationLabel, setCustomerLocationLabel] = useState("")
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState("")

  // Livraison
  const [deliveryMode, setDeliveryMode] = useState("pickup")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryCity, setDeliveryCity] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [customerPhone, setCustomerPhone] = useState("")

  // Paiement
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [extraPhoneNumber, setExtraPhoneNumber] = useState("")
  const [amountPaid, setAmountPaid] = useState(0)

  // Global
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)

  // -- Chargement initial ---------------------------------
  useEffect(() => {
    customersService.getAll({ page_size: 200 })
      .then((r) => setCustomers(r.data.results || r.data))
      .catch(() => toast.error("Impossible de charger les clients"))
  }, [])

  // Charger TOUS les produits actifs au montage (grille 3 colonnes par défaut)
  useEffect(() => {
    setLoadingProducts(true)
    productsService.getAll({ is_active: true, page_size: 100 })
      .then((r) => setAllProducts(r.data.results || r.data))
      .catch(() => setAllProducts([]))
      .finally(() => setLoadingProducts(false))
  }, [])

  // Recherche (filtre côté serveur quand l'utilisateur tape)
  useEffect(() => {
    if (search.trim().length < 2) { setProducts([]); return }
    productsService.getAll({ search, is_active: true, page_size: 50 })
      .then((r) => setProducts(r.data.results || r.data))
      .catch(() => setProducts([]))
  }, [search])

  // -- Géolocalisation du client --------------------------
  const handleLocateCustomer = () => {
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas supportée par votre navigateur.")
      return
    }
    setLocating(true)
    setLocationError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setCustomerLat(latitude)
        setCustomerLng(longitude)
        // Reverse geocoding simple via OpenStreetMap Nominatim (gratuit, pas de clé API)
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then((r) => r.json())
          .then((data) => {
            const label = data?.display_name || ""
            setCustomerLocationLabel(label)
            // Pré-remplit l'adresse de livraison si elle est vide
            if (!deliveryAddress && label) {
              setDeliveryAddress(label.split(",").slice(0, 3).join(","))
            }
          })
          .catch(() => setCustomerLocationLabel(""))
          .finally(() => setLocating(false))
        toast.success("Position du client enregistrée !")
      },
      (err) => {
        setLocating(false)
        setLocationError(
          err.code === 1
            ? "Vous avez refusé l'accès à la localisation."
            : "Impossible d'obtenir la position. Réessayez."
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // -- Panier ---------------------------------------------
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) { toast.error(`Stock insuffisant`); return prev }
        return prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      if (product.quantity < 1) { toast.error(`Rupture de stock`); return prev }
      return [...prev, {
        product_id: product.id, name: product.name, reference: product.reference,
        unit_price: parseFloat(product.selling_price), quantity: 1,
        max_qty: product.quantity, discount_percent: 0,
      }]
    })
    toast.success(`${product.name} ajouté`)
  }

  const updateQty = (product_id, delta) => {
    setCart((prev) => prev.map((i) => {
      if (i.product_id !== product_id) return i
      const newQty = i.quantity + delta
      if (newQty < 1) return i
      if (newQty > i.max_qty) { toast.error("Stock insuffisant"); return i }
      return { ...i, quantity: newQty }
    }))
  }

  const removeItem = (product_id) => setCart((prev) => prev.filter((i) => i.product_id !== product_id))

  // -- Calculs --------------------------------------------
  const taxRate = 18
  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const discountAmount = (subtotal * discountPercent) / 100
  const afterDiscount = subtotal - discountAmount
  const taxAmount = (afterDiscount * taxRate) / 100
  const currentDeliveryFee = deliveryMode === "delivery" ? deliveryFee : 0
  const total = afterDiscount + taxAmount + currentDeliveryFee
  const selectedCustomer = customers.find((c) => String(c.id) === String(customerId)) || null
  const displayDeliveryAddress = deliveryMode === "delivery" ? [deliveryAddress, deliveryCity].filter(Boolean).join(", ") : ""

  // -- Navigation -----------------------------------------
  const goNext = () => {
    if (step === 1 && cart.length === 0) { toast.error("Ajoutez au moins un produit au panier"); return }
    if (step === 3 && deliveryMode === "delivery" && !deliveryAddress.trim()) { toast.error("Saisissez l'adresse de livraison"); return }
    setStep((s) => Math.min(s + 1, 5))
  }
  const goPrev = () => setStep((s) => Math.max(s - 1, 1))

  // -- Validation finale ----------------------------------
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await salesService.create({
        customer_id: customerId || null,
        payment_method: paymentMethod,
        discount_percent: discountPercent,
        tax_rate: taxRate,
        amount_paid: amountPaid,
        notes,
        customer_latitude: customerLat,
        customer_longitude: customerLng,
        items: cart.map((i) => ({
          product_id: i.product_id, quantity: i.quantity,
          unit_price: i.unit_price, discount_percent: i.discount_percent,
        })),
      })
      setSuccess(res.data)
      toast.success("Vente enregistrée avec succès !")
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur lors de l'enregistrement")
    } finally { setLoading(false) }
  }

  const handleDownloadPdf = async () => {
    if (!success) return
    try {
      const res = await salesService.getPdf(success.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
      const a = document.createElement("a")
      a.href = url; a.download = `facture_${success.invoice_number}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success("Facture téléchargée !")
    } catch { toast.error("Impossible de télécharger la facture") }
  }

  const handleNewSale = () => {
    setSuccess(null); setCart([]); setStep(1); setCustomerId(""); setDiscountPercent(0)
    setNotes(""); setDeliveryMode("pickup"); setDeliveryAddress(""); setDeliveryCity("")
    setDeliveryFee(0); setCustomerPhone(""); setAmountPaid(0); setPaymentMethod("cash")
    setExtraPhoneNumber(""); setSearch(""); setProducts([])
    setCustomerLat(null); setCustomerLng(null); setCustomerLocationLabel(""); setLocationError("")
  }

  if (success) {
    return <SuccessScreen sale={success} onNewSale={handleNewSale}
      onViewHistory={() => navigate("/sales")} onDownloadPdf={handleDownloadPdf} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle vente</h1>
        <p className="text-sm text-gray-500 mt-0.5">Enregistrez une nouvelle vente</p>
      </div>

      <Stepper currentStep={step} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {step === 1 && (
            <StepPanier
              search={search} setSearch={setSearch}
              products={products} allProducts={allProducts} loadingProducts={loadingProducts}
              cart={cart} onAdd={addToCart}
              onIncrease={(id) => updateQty(id, 1)} onDecrease={(id) => updateQty(id, -1)}
              onDelete={removeItem}
            />
          )}
          {step === 2 && (
            <StepClient
              customers={customers} customerId={customerId} setCustomerId={setCustomerId}
              discountPercent={discountPercent} setDiscountPercent={setDiscountPercent}
              notes={notes} setNotes={setNotes}
              customerLat={customerLat} customerLng={customerLng}
              customerLocationLabel={customerLocationLabel}
              onLocateCustomer={handleLocateCustomer}
              locating={locating} locationError={locationError}
            />
          )}
          {step === 3 && (
            <StepLivraison
              deliveryMode={deliveryMode} setDeliveryMode={setDeliveryMode}
              deliveryAddress={deliveryAddress} setDeliveryAddress={setDeliveryAddress}
              deliveryCity={deliveryCity} setDeliveryCity={setDeliveryCity}
              deliveryFee={deliveryFee} setDeliveryFee={setDeliveryFee}
              customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
              customerLat={customerLat} customerLng={customerLng}
            />
          )}
          {step === 4 && (
            <StepPaiement
              paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
              extraPhoneNumber={extraPhoneNumber} setExtraPhoneNumber={setExtraPhoneNumber}
              total={total} amountPaid={amountPaid} setAmountPaid={setAmountPaid}
            />
          )}
          {step === 5 && (
            <StepResume
              cart={cart} subtotal={subtotal} discountAmount={discountAmount}
              taxAmount={taxAmount} deliveryFee={currentDeliveryFee} total={total}
              paymentMethod={paymentMethod} amountPaid={amountPaid}
              selectedCustomer={selectedCustomer} deliveryAddress={deliveryAddress}
              deliveryCity={deliveryCity} notes={notes}
              customerLat={customerLat} customerLng={customerLng}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={goPrev} disabled={step === 1}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all
                ${step === 1 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
              <ChevronLeft size={18} /> Précédent
            </button>

            {step < 5 ? (
              <button type="button" onClick={goNext}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm">
                Suivant <ChevronRight size={18} />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading}
                className={`flex items-center gap-2 font-semibold px-6 py-2.5 rounded-xl text-sm transition-all
                  ${loading ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-700 hover:bg-blue-800 text-white shadow-sm"}`}>
                <CheckCircle size={18} />
                {loading ? "Enregistrement..." : `Valider la vente - ${formatCurrency(total)}`}
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <SidePanel cart={cart} subtotal={subtotal} discountAmount={discountAmount}
            deliveryFee={currentDeliveryFee} total={total} paymentMethod={paymentMethod}
            selectedCustomer={selectedCustomer} deliveryAddress={displayDeliveryAddress} />
        </div>
      </div>
    </div>
  )
}







