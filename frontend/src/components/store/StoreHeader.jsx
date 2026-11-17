import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import {
  Search, ShoppingCart, User, HelpCircle, ChevronDown, LayoutGrid,
} from "lucide-react"
import { logoutUser } from "../../store/slices/authSlice"
import { useStoreCatalog } from "../../hooks/useStoreCatalog"
import { categoryIcon } from "./categoryIcon"
import logo from "../../assets/logo.png"

const formatPrice = price =>
  new Intl.NumberFormat("fr-FR").format(Number(price || 0))

// Petit menu déroulant (survol sur ordinateur, clic sur mobile)
function HeaderMenu({ trigger, children, width = "w-60" }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const close = event => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }

    document.addEventListener("mousedown", close)
    document.addEventListener("touchstart", close)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("touchstart", close)
    }
  }, [open])

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded px-2 py-2 text-sm text-[#313133] transition hover:bg-[#f5f5f5]"
      >
        {trigger}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className={`absolute right-0 top-full z-40 ${width} rounded-md border border-[#ededed] bg-white py-2 shadow-[0_4px_16px_rgba(0,0,0,0.15)]`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

const menuLink =
  "block px-4 py-2.5 text-sm text-[#313133] transition hover:bg-[#f5f5f5]"

export default function StoreHeader({
  search,
  onSearchChange,
  showSearch = true,
  showCategories = true,
}) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { isAuthenticated, user } = useSelector(state => state.auth)
  const cartItems = useSelector(state => state.cart.items || [])
  const { categories, products } = useStoreCatalog()

  const [localSearch, setLocalSearch] = useState("")
  const [hoverCategory, setHoverCategory] = useState(null)

  const searchValue = search ?? localSearch
  const activeCategory = searchParams.get("category")

  const cartCount = cartItems.reduce(
    (total, item) => total + (item.cartQuantity || 0),
    0
  )

  const isStaff = ["admin", "manager", "cashier"].includes(user?.role)
  const accountPath = isStaff ? "/profile" : "/client"
  const firstName = user?.first_name || user?.username || "Client"

  const handleSearchChange = value => {
    setLocalSearch(value)
    onSearchChange?.(value)
  }

  const submitSearch = event => {
    event.preventDefault()
    const term = searchValue.trim()
    navigate(term ? `/client/products?search=${encodeURIComponent(term)}` : "/client/products")
  }

  const handleLogout = () => {
    dispatch(logoutUser())
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    navigate("/", { replace: true })
  }

  const hoveredProducts = hoverCategory
    ? products.filter(product => String(product.category) === String(hoverCategory.id)).slice(0, 12)
    : []

  return (
    <header className="sticky top-0 z-30 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
      {/* Fine barre d'information */}
      <div className="hidden bg-[#f1f1f2] text-[11px] text-[#75757a] md:block">
        <div className="mx-auto flex h-7 max-w-[1200px] items-center justify-between px-4">
          <span>Livraison partout au Sénégal</span>
          <span>Paiement par Wave, Orange Money ou carte bancaire</span>
        </div>
      </div>

      {/* Logo, recherche, compte, aide, panier */}
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:flex-nowrap md:gap-x-5">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="TechShop Electronics - Accueil">
          <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" />
          <span className="font-['Ubuntu',sans-serif] text-[22px] font-bold leading-none text-[#313133]">
            Tech<span className="text-[#f68b1e]">Shop</span>
          </span>
        </Link>

        {showSearch && (
          <form
            onSubmit={submitSearch}
            role="search"
            className="order-last flex w-full min-w-0 md:order-none md:flex-1"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a9a9ad]" />
              <input
                type="search"
                value={searchValue}
                onChange={event => handleSearchChange(event.target.value)}
                placeholder="Cherchez un produit, une marque ou une catégorie"
                aria-label="Rechercher un produit"
                className="h-10 w-full rounded-l-md border border-[#d7d7da] bg-[#f5f5f5] pl-10 pr-3 text-sm text-[#313133] placeholder:text-[#a9a9ad] focus:border-[#f68b1e] focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-r-md bg-[#f68b1e] px-5 text-sm font-semibold text-white transition hover:bg-[#e07b0e]"
            >
              Rechercher
            </button>
          </form>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          {isAuthenticated ? (
            <HeaderMenu
              trigger={
                <>
                  <User className="h-5 w-5" />
                  <span className="hidden max-w-[110px] truncate md:inline">Salut, {firstName}</span>
                </>
              }
            >
              <Link to={accountPath} className={menuLink}>
                {isStaff ? "Mon profil" : "Mon compte"}
              </Link>
              {!isStaff && (
                <Link to="/client?section=orders" className={menuLink}>
                  Mes commandes
                </Link>
              )}
              {isStaff && (
                <Link to="/dashboard" className={menuLink}>
                  Mon espace de gestion
                </Link>
              )}
              <div className="my-1 border-t border-[#ededed]" />
              <button
                type="button"
                onClick={handleLogout}
                className={`${menuLink} w-full text-left font-semibold text-[#f68b1e]`}
              >
                Se déconnecter
              </button>
            </HeaderMenu>
          ) : (
            <HeaderMenu
              trigger={
                <>
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">Se connecter</span>
                </>
              }
            >
              <div className="px-4 pb-2">
                <Link
                  to="/login"
                  className="block rounded bg-[#f68b1e] py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#e07b0e]"
                >
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  className="mt-2 block text-center text-sm font-medium text-[#f68b1e] hover:underline"
                >
                  Créer un compte
                </Link>
              </div>
              <div className="my-1 border-t border-[#ededed]" />
              <Link to="/client" className={menuLink}>Mon compte</Link>
              <Link to="/client?section=orders" className={menuLink}>Mes commandes</Link>
            </HeaderMenu>
          )}

          <div className="hidden sm:block">
            <HeaderMenu
              width="w-56"
              trigger={
                <>
                  <HelpCircle className="h-5 w-5" />
                  <span className="hidden lg:inline">Aide</span>
                </>
              }
            >
              <a href="mailto:contact@techshop-electronics.com" className={menuLink}>
                Centre d'aide
              </a>
              <Link to="/client?section=orders" className={menuLink}>
                Suivre ma commande
              </Link>
              <a href="tel:+221000000000" className={menuLink}>
                Nous appeler
              </a>
            </HeaderMenu>
          </div>

          <Link
            to="/client/cart"
            className="relative ml-1 flex items-center gap-2 rounded px-2 py-2 text-sm text-[#313133] transition hover:bg-[#f5f5f5]"
            aria-label={`Panier, ${cartCount} article${cartCount > 1 ? "s" : ""}`}
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">Panier</span>
            {cartCount > 0 && (
              <span key={cartCount} className="animate-pop absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f68b1e] px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Menu des catégories avec méga-menu au survol */}
      {showCategories && (
        <nav
          aria-label="Catégories"
          className="relative border-t border-[#ededed] bg-white"
          onMouseLeave={() => setHoverCategory(null)}
        >
          <div className="mx-auto flex max-w-[1200px] items-center gap-1 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              to="/client/products"
              onMouseEnter={() => setHoverCategory(null)}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap px-2.5 py-3 text-[13px] text-[#55555a] transition hover:text-[#f68b1e]"
            >
              <LayoutGrid className="h-4 w-4" />
              Tous les produits
            </Link>

            {categories.map(category => {
              const Icon = categoryIcon(category.name)
              const isActive = String(activeCategory) === String(category.id)

              return (
                <Link
                  key={category.id}
                  to={`/client/products?category=${category.id}`}
                  onMouseEnter={() => setHoverCategory(category)}
                  onFocus={() => setHoverCategory(category)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-2.5 py-3 text-[13px] transition hover:text-[#f68b1e] ${
                    isActive || hoverCategory?.id === category.id
                      ? "text-[#f68b1e]"
                      : "text-[#55555a]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {category.name}
                </Link>
              )
            })}
          </div>

          {hoverCategory && hoveredProducts.length > 0 && (
            <div className="absolute inset-x-0 top-full z-40 hidden md:block">
              <div className="mx-auto max-w-[1200px] px-4">
                <div className="grid grid-cols-[200px_1fr] gap-6 rounded-b-md border border-t-0 border-[#ededed] bg-white p-5 shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
                  <div>
                    <p className="font-['Ubuntu',sans-serif] text-base font-bold text-[#313133]">
                      {hoverCategory.name}
                    </p>
                    {hoverCategory.description && (
                      <p className="mt-1 text-xs text-[#75757a]">{hoverCategory.description}</p>
                    )}
                    <Link
                      to={`/client/products?category=${hoverCategory.id}`}
                      onClick={() => setHoverCategory(null)}
                      className="mt-3 inline-block text-sm font-semibold text-[#f68b1e] hover:underline"
                    >
                      Voir tout
                    </Link>
                  </div>

                  <ul className="grid grid-cols-2 gap-x-6 gap-y-1 lg:grid-cols-3">
                    {hoveredProducts.map(product => (
                      <li key={product.id}>
                        <Link
                          to={`/client/products?search=${encodeURIComponent(product.name)}`}
                          onClick={() => setHoverCategory(null)}
                          className="flex items-baseline justify-between gap-3 rounded px-2 py-1.5 text-[13px] text-[#313133] transition hover:bg-[#f5f5f5] hover:text-[#f68b1e]"
                        >
                          <span className="truncate">{product.name}</span>
                          <span className="shrink-0 text-xs text-[#75757a]">
                            {formatPrice(product.selling_price)} FCFA
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}
