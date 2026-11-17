import { useState, useEffect } from "react"
import { usersService } from "../../services/usersService"
import PageHeader from "../../components/common/PageHeader"
import LoadingSpinner from "../../components/common/LoadingSpinner"
import Pagination from "../../components/common/Pagination"
import { formatDateTime } from "../../utils/formatters"
import { FileText, LogIn, LogOut, Plus, Pencil, Trash2, Eye, Download } from "lucide-react"

const ACTION_ICONS = {
  login:    <LogIn className="w-3.5 h-3.5 text-green-600" />,
  logout:   <LogOut className="w-3.5 h-3.5 text-gray-500" />,
  create:   <Plus className="w-3.5 h-3.5 text-blue-600" />,
  update:   <Pencil className="w-3.5 h-3.5 text-orange-500" />,
  delete:   <Trash2 className="w-3.5 h-3.5 text-red-500" />,
  view:     <Eye className="w-3.5 h-3.5 text-gray-500" />,
  export:   <Download className="w-3.5 h-3.5 text-purple-500" />,
}

const ACTION_COLORS = {
  login:   "bg-green-100 text-green-700",
  logout:  "bg-gray-100 text-gray-600",
  create:  "bg-blue-100 text-blue-700",
  update:  "bg-orange-100 text-orange-700",
  delete:  "bg-red-100 text-red-700",
  view:    "bg-gray-100 text-gray-600",
  export:  "bg-purple-100 text-purple-700",
}

export default function Activity() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    usersService.getActivity()
      .then(r => {
        const d = r.data
        if (d.results) { setLogs(d.results); setTotal(d.count) }
        else { setLogs(d); setTotal(d.length) }
      }).finally(() => setLoading(false))
  }, [page])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d Activité"
        subtitle={`${total} action(s) enregistrée(s)`}
      />
      {loading ? <LoadingSpinner /> : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>{["Date","Utilisateur","Action","Ressource","Description","IP"].map(h=><th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody className="bg-white">
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="font-medium text-sm">{log.user_name || "-"}</td>
                  <td>
                    <span className={`badge flex items-center space-x-1 w-fit ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                      {ACTION_ICONS[log.action]}
                      <span>{log.action_display}</span>
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">{log.resource}</td>
                  <td className="text-sm text-gray-600 max-w-xs truncate">{log.description}</td>
                  <td className="text-xs font-mono text-gray-400">{log.ip_address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={Math.ceil(total/20)} onPageChange={setPage} total={total} perPage={20} />
          </div>
        </div>
      )}
    </div>
  )
}
