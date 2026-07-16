'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'

export interface WidgetDef {
  id: string
  label: string
  category: 'kpi' | 'chart'
  defaultW: number
  defaultH: number
  minW?: number
  minH?: number
}

export const ALL_WIDGETS: WidgetDef[] = [
  { id: 'revenue', label: 'Faturamento Líquido', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'spend', label: 'Gastos com Anúncios', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'roas', label: 'ROAS', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'profit', label: 'Lucro Líquido', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'pending', label: 'Vendas Pendentes', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'margin', label: 'Margem de Lucro', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'arpu', label: 'ARPU', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'chargeback', label: 'Chargeback', category: 'kpi', defaultW: 1, defaultH: 1 },
  { id: 'payment_pie', label: 'Vendas por Pagamento', category: 'chart', defaultW: 1, defaultH: 2, minW: 1, minH: 2 },
  { id: 'revenue_chart', label: 'Receita vs Gasto', category: 'chart', defaultW: 2, defaultH: 2, minW: 1, minH: 2 },
  { id: 'funnel', label: 'Funil de Conversão', category: 'chart', defaultW: 3, defaultH: 2, minW: 2, minH: 2 },
]

export const DEFAULT_VISIBLE = ALL_WIDGETS.map(w => w.id)

interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

interface DashboardContextValue {
  layout: LayoutItem[]
  visibleWidgets: string[]
  editMode: boolean
  contextMenu: { x: number; y: number } | null
  setLayout: (layout: LayoutItem[]) => void
  toggleWidget: (id: string) => void
  setEditMode: (v: boolean) => void
  setContextMenu: (pos: { x: number; y: number } | null) => void
  reorderWidgets: (from: string, to: string) => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<LayoutItem[]>([])
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(DEFAULT_VISIBLE)
  const [editMode, setEditMode] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from Supabase
  useEffect(() => {
    fetch('/api/dashboard/layout')
      .then(r => r.json())
      .then(data => {
        if (data.layout?.length > 0) setLayoutState(data.layout)
        if (data.visible_widgets?.length > 0) setVisibleWidgets(data.visible_widgets)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Save to Supabase with debounce
  const saveLayout = useCallback((newLayout: LayoutItem[], newVisible: string[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: newLayout, visible_widgets: newVisible }),
      }).catch(() => {})
    }, 500)
  }, [])

  const setLayout = useCallback((newLayout: LayoutItem[]) => {
    setLayoutState(newLayout)
    saveLayout(newLayout, visibleWidgets)
  }, [visibleWidgets, saveLayout])

  const toggleWidget = useCallback((id: string) => {
    setVisibleWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
      saveLayout(layout, next)
      return next
    })
  }, [layout, saveLayout])

  const reorderWidgets = useCallback((from: string, to: string) => {
    setVisibleWidgets(prev => {
      const fromIdx = prev.indexOf(from)
      const toIdx = prev.indexOf(to)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, from)
      saveLayout(layout, next)
      return next
    })
  }, [layout, saveLayout])

  return (
    <DashboardContext.Provider value={{
      layout,
      visibleWidgets,
      editMode,
      contextMenu,
      setLayout,
      toggleWidget,
      setEditMode,
      setContextMenu,
      reorderWidgets,
    }}>
      {children}
    </DashboardContext.Provider>
  )
}
