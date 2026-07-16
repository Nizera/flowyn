'use client'

// Dashboard context removido - drag-and-drop desativado
// Este arquivo existe apenas para compatibilidade de imports

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function useDashboard() {
  return {
    setContextMenu: () => {},
  }
}