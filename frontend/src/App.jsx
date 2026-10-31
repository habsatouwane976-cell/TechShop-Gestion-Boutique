import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { lazy, Suspense, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { fetchCurrentUser } from "./store/slices/authSlice"

// Layouts
import MainLayout from "./layouts/MainLayout"
import { DashboardSkeleton } from "./components/common/Skeleton"

// Auth
import Login from "./pages/auth/Login"
import Register from "./pages/auth/Register"
import VerifyEmail from "./pages/auth/VerifyEmail"

// Accueil boutique
import HomePage from "./pages/home/HomePage"
import ChatbotWidget from "./components/common/ChatbotWidget"

// Client
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"))
const ClientProducts = lazy(() => import("./pages/client/ClientProducts"))
const ClientCart = lazy(() => import("./pages/client/ClientCart"))
// Pages
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"))
const Products = lazy(() => import("./pages/products/Products"))
const Sales = lazy(() => import("./pages/sales/Sales"))
const NewSale = lazy(() => import("./pages/sales/NewSale"))
const Customers = lazy(() => import("./pages/customers/Customers"))
const Suppliers = lazy(() => import("./pages/suppliers/Suppliers"))
const Inventory = lazy(() => import("./pages/inventory/Inventory"))
const Reports = lazy(() => import("./pages/reports/Reports"))
const Users = lazy(() => import("./pages/users/Users"))
const Activity = lazy(() => import("./pages/users/Activity"))
const Profile = lazy(() => import("./pages/profile/Profile"))
const MapPage = lazy(() => import("./pages/map/MapPage"))


function RequireAuth({ children, roles }) {
  const { isAuthenticated, user } = useSelector(state => state.auth)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (roles && !roles.includes(user?.role)) {
    const redirectPath =
      user?.role === "customer"
        ? "/client"
        : "/dashboard"

    return <Navigate to={redirectPath} replace />
  }

  return children
}


export default function App() {
  const dispatch = useDispatch()

  const {
    isAuthenticated,
    user,
    loading,
  } = useSelector(state => state.auth)

  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      dispatch(fetchCurrentUser())
    }
  }, [dispatch])

  useEffect(() => {
    if (localStorage.getItem("darkMode") === "true") {
      document.body.classList.add("dark")
    }
  }, [])

  if (
    localStorage.getItem("access_token") &&
    isAuthenticated &&
    !user &&
    loading
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Chargement...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <ChatbotWidget />
      <Suspense fallback={<div className="p-6"><DashboardSkeleton /></div>}>
      <Routes>

        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Accueil e-commerce : visible sans se connecter */}
        <Route path="/" element={<HomePage />} />

        {/* Espace client */}
        <Route
          path="/client"
          element={
            <RequireAuth roles={["customer"]}>
              <ClientDashboard />
            </RequireAuth>
          }
        />
        {/* Boutique e-commerce : accessible à tout utilisateur connecté,
            quel que soit son rôle (admin, manager, cashier ou customer) */}
        {/* Panier et catalogue visibles sans compte : la connexion est demandée à la commande */}
        <Route path="/client/cart" element={<ClientCart />} />
        <Route path="/client/products" element={<ClientProducts />} />
        {/* Espace administration */}
        <Route
          element={
            <RequireAuth roles={["admin", "manager", "cashier"]}>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />

          <Route
            path="/products"
            element={
              <RequireAuth roles={["admin", "manager"]}>
                <Products />
              </RequireAuth>
            }
          />

          <Route path="/sales" element={<Sales />} />
          <Route path="/sales/new" element={<NewSale />} />

          <Route
            path="/customers"
            element={
              <RequireAuth roles={["admin", "manager"]}>
                <Customers />
              </RequireAuth>
            }
          />

          <Route
            path="/suppliers"
            element={
              <RequireAuth roles={["admin", "manager"]}>
                <Suppliers />
              </RequireAuth>
            }
          />

          <Route
            path="/inventory"
            element={
              <RequireAuth roles={["admin", "manager"]}>
                <Inventory />
              </RequireAuth>
            }
          />

          <Route
            path="/reports"
            element={
              <RequireAuth roles={["admin", "manager"]}>
                <Reports />
              </RequireAuth>
            }
          />

          <Route
            path="/users"
            element={
              <RequireAuth roles={["admin"]}>
                <Users />
              </RequireAuth>
            }
          />

          <Route
            path="/activity"
            element={
              <RequireAuth roles={["admin"]}>
                <Activity />
              </RequireAuth>
            }
          />

          <Route path="/profile" element={<Profile />} />
          <Route path="/map" element={<MapPage />} />
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                isAuthenticated
                  ? user?.role === "customer"
                    ? "/client"
                    : "/dashboard"
                  : "/"
              }
              replace
            />
          }
        />

      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}