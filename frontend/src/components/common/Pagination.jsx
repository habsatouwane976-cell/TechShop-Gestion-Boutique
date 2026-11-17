import { ChevronLeft, ChevronRight } from "lucide-react"
export default function Pagination({ page, totalPages, onPageChange, total, perPage }) {
  if (totalPages <= 1) return null
  const pages = []
  for (let p = Math.max(1, page-2); p <= Math.min(totalPages, page+2); p++) pages.push(p)
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-500">
        {total && `${(page-1)*perPage+1}-${Math.min(page*perPage, total)} sur ${total}`}
      </p>
      <div className="flex items-center space-x-1">
        <button onClick={() => onPageChange(page-1)} disabled={page===1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages[0] > 1 && <>
          <button onClick={() => onPageChange(1)} className="w-9 h-9 rounded-lg text-sm hover:bg-gray-100">1</button>
          {pages[0] > 2 && <span className="px-1 text-gray-400">…</span>}
        </>}
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`w-9 h-9 rounded-lg text-sm font-medium ${p===page ? "bg-primary-700 text-white" : "hover:bg-gray-100 text-gray-700"}`}>
            {p}
          </button>
        ))}
        {pages[pages.length-1] < totalPages && <>
          {pages[pages.length-1] < totalPages-1 && <span className="px-1 text-gray-400">…</span>}
          <button onClick={() => onPageChange(totalPages)} className="w-9 h-9 rounded-lg text-sm hover:bg-gray-100">{totalPages}</button>
        </>}
        <button onClick={() => onPageChange(page+1)} disabled={page===totalPages}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}