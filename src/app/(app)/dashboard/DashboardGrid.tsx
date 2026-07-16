'use client'

import { useMemo, useCallback } from 'react'
import { useContainerWidth, ResponsiveGridLayout } from 'react-grid-layout'
import { useDashboard, ALL_WIDGETS } from '@/contexts/DashboardContext'
import 'react-grid-layout/css/styles.css'

const COLS = { lg: 3, md: 3, sm: 2, xs: 1 }
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 0 }

interface DashboardGridProps {
  data: any
  kpiCards: { id: string; label: string; value: string; icon: any; color?: string }[]
  children: (widgetId: string) => React.ReactNode
}

export function DashboardGrid({ data, kpiCards, children }: DashboardGridProps) {
  const { layout, visibleWidgets, editMode, setLayout } = useDashboard()
  const { width, containerRef } = useContainerWidth({ initialWidth: 1200 })

  const defaultLayouts = useMemo(() => {
    const lg: any[] = []
    let y = 0
    const widgetsInOrder = ALL_WIDGETS.filter(w => visibleWidgets.includes(w.id))

    widgetsInOrder.forEach(w => {
      const existing = layout.find(l => l.i === w.id)
      if (existing) {
        lg.push(existing)
      } else {
        if (w.category === 'kpi') {
          const kpiCount = lg.filter(l => ALL_WIDGETS.find(aw => aw.id === l.i)?.category === 'kpi').length
          lg.push({ i: w.id, x: kpiCount % 3, y: Math.floor(kpiCount / 3), w: 1, h: 1 })
        } else {
          lg.push({ i: w.id, x: 0, y: y + 1, w: w.defaultW, h: w.defaultH })
          y += w.defaultH
        }
      }
    })
    return { lg }
  }, [layout, visibleWidgets])

  const handleLayoutChange = useCallback((_layout: any, allLayouts: any) => {
    if (allLayouts.lg) {
      setLayout(allLayouts.lg)
    }
  }, [setLayout])

  const items = useMemo(() => {
    return ALL_WIDGETS.filter(w => visibleWidgets.includes(w.id))
  }, [visibleWidgets])

  return (
    <div ref={containerRef} className="w-full">
      <ResponsiveGridLayout
        width={width}
        className="layout"
        layouts={defaultLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={80}
        margin={[24, 24]}
        dragConfig={{ enabled: editMode, handle: '.drag-handle' }}
        resizeConfig={{ enabled: editMode, handles: ['se'] }}
        onLayoutChange={handleLayoutChange}
      >
        {items.map(widget => (
          <div key={widget.id} className={editMode ? 'rounded-2xl ring-2 ring-blue-200 transition-shadow' : ''}>
            <div className="relative h-full">
              {editMode && (
                <div className="drag-handle absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing rounded-lg border border-slate-200 bg-white/90 p-1.5 shadow-sm transition-colors hover:bg-slate-50">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </div>
              )}
              {children(widget.id)}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}
