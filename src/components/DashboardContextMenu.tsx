'use client'

import { useEffect, useRef } from 'react'
import { useDashboard, ALL_WIDGETS } from '@/contexts/DashboardContext'
import { Eye, EyeOff, GripVertical, BarChart3, Hash } from 'lucide-react'

export function DashboardContextMenu() {
  const { contextMenu, setContextMenu, visibleWidgets, toggleWidget, setEditMode, editMode } = useDashboard()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [contextMenu, setContextMenu])

  if (!contextMenu) return null

  const kpiWidgets = ALL_WIDGETS.filter(w => w.category === 'kpi')
  const chartWidgets = ALL_WIDGETS.filter(w => w.category === 'chart')

  // Adjust position to stay within viewport
  const menuWidth = 280
  const menuHeight = 420
  const x = Math.min(contextMenu.x, window.innerWidth - menuWidth - 16)
  const y = Math.min(contextMenu.y, window.innerHeight - menuHeight - 16)

  return (
    <div className="fixed inset-0 z-[999]" onClick={() => setContextMenu(null)}>
      <div
        ref={ref}
        className="fixed w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        style={{ left: x, top: y }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Personalizar Dashboard</p>
        </div>

        {/* Edit mode toggle */}
        <div className="px-4 py-2 border-b border-slate-100">
          <button
            onClick={() => {
              setEditMode(!editMode)
              setContextMenu(null)
            }}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
            {editMode ? 'Sair do Modo Edição' : 'Arrastar Widgets'}
          </button>
        </div>

        {/* KPI Metrics */}
        <div className="px-4 py-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Hash className="h-3 w-3" /> Métricas (KPIs)
          </p>
          <div className="space-y-0.5">
            {kpiWidgets.map(widget => {
              const active = visibleWidgets.includes(widget.id)
              return (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className="flex items-center gap-2 w-full rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
                >
                  {active
                    ? <Eye className="h-3.5 w-3.5 text-blue-500" />
                    : <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                  }
                  <span className={active ? 'font-bold text-slate-700' : 'text-slate-400'}>{widget.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chart Metrics */}
        <div className="px-4 py-2 border-t border-slate-100">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Gráficos
          </p>
          <div className="space-y-0.5">
            {chartWidgets.map(widget => {
              const active = visibleWidgets.includes(widget.id)
              return (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className="flex items-center gap-2 w-full rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors"
                >
                  {active
                    ? <Eye className="h-3.5 w-3.5 text-blue-500" />
                    : <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                  }
                  <span className={active ? 'font-bold text-slate-700' : 'text-slate-400'}>{widget.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => {
              // Reset to defaults
              fetch('/api/dashboard/layout', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: [], visible_widgets: ALL_WIDGETS.map(w => w.id) }),
              }).then(() => window.location.reload())
            }}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Restaurar padrão
          </button>
        </div>
      </div>
    </div>
  )
}
