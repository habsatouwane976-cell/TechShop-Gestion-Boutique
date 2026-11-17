import { SALE_STATUS } from "../../utils/constants"
import { cleanLabel } from "../../utils/formatters"
export default function StatusBadge({ status }) {
  const cfg = SALE_STATUS[status] || { label: cleanLabel(status), color: "bg-gray-100 text-gray-700" }
  return <span className={`badge ${cfg.color}`}>{cfg.label}</span>
}