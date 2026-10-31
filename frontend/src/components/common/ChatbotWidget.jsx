import { useEffect } from "react"
import { useSelector } from "react-redux"
import Typebot from "@typebot.io/js/web"

const TYPEBOT_ID = import.meta.env.VITE_TYPEBOT_ID
const VIEWER_URL = import.meta.env.VITE_TYPEBOT_VIEWER_URL || "http://localhost:8091"

const PRIMARY = "#f68b1e"
const INK = "#313133"
const STAFF_ROLES = ["admin", "manager", "cashier"]

/** Nom et téléphone du client connecté : le bot ne les redemande pas. */
function prefilledVariables(user) {
  if (user?.role !== "customer") return {}
  const nom = user.full_name?.trim() || user.username
  return { ...(nom && { nom }), ...(user.phone && { telephone: user.phone }) }
}

function mountBubble(variables) {
  Typebot.initBubble({
    typebot: TYPEBOT_ID,
    apiHost: VIEWER_URL,
    prefilledVariables: variables,
    theme: {
      button: {
        backgroundColor: PRIMARY,
        iconColor: "#ffffff",
        customIconSrc: `${window.location.origin}/chatbot-icon.svg`,
        size: "large",
      },
      previewMessage: {
        message: "Une question sur un produit ou une commande ?",
        autoShowDelay: 6000,
        backgroundColor: "#ffffff",
        textColor: INK,
      },
      chatWindow: { backgroundColor: "#f5f5f5" },
    },
  })
}

/**
 * Bulle de chat Typebot (assistant TechShop), réservée aux visiteurs et aux clients.
 * Inactive tant que VITE_TYPEBOT_ID n'est pas défini.
 */
export default function ChatbotWidget() {
  const { user, isAuthenticated } = useSelector(state => state.auth)
  const isStaff = STAFF_ROLES.includes(user?.role)
  const isWaitingForProfile = isAuthenticated && !user
  const variablesKey = JSON.stringify(prefilledVariables(user))

  useEffect(() => {
    if (!TYPEBOT_ID || isStaff || isWaitingForProfile) return undefined
    mountBubble(JSON.parse(variablesKey))
    return () => document.querySelectorAll("typebot-bubble").forEach(node => node.remove())
  }, [isStaff, isWaitingForProfile, variablesKey])

  return null
}
