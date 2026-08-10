'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission)
    checkSubscription()
  }, [isSupported])

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch {
      // Service worker not ready yet
    }
  }

  const getPushManager = async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager
  }

  const subscribe = useCallback(async () => {
    if (!isSupported) return

    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VAPID_PUBLIC_KEY not configured')
      setShowPrompt(false)
      return
    }

    setLoading(true)
    try {
      const newPermission = await Notification.requestPermission()
      setPermission(newPermission)

      if (newPermission !== 'granted') {
        setLoading(false)
        setShowPrompt(false)
        return
      }

      const pushManager = await getPushManager()
      const existingSubscription = await pushManager.getSubscription()

      let subscription = existingSubscription
      if (!subscription) {
        subscription = await pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const { endpoint } = subscription
      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const response = await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh, auth }),
      })

      if (response.ok) {
        setIsSubscribed(true)
      }
      setShowPrompt(false)
    } catch (err) {
      console.error('[Push] Subscribe error:', err)
      setShowPrompt(false)
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return

    setLoading(true)
    try {
      const pushManager = await getPushManager()
      const subscription = await pushManager.getSubscription()

      if (subscription) {
        const { endpoint } = subscription
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err)
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  useEffect(() => {
    if (isSupported && permission === 'default' && !isSubscribed) {
      const timer = setTimeout(() => setShowPrompt(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [isSupported, permission, isSubscribed])

  if (!isSupported) return null

  return (
    <>
      <AnimatePresence>
        {showPrompt && !isSubscribed && permission === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Receber notificacoes</p>
                <p className="mt-1 text-xs text-muted">
                  Seja alertado quando houver uma nova venda, mesmo com o navegador fechado.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={subscribe}
                    disabled={loading}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ativar'}
                  </button>
                  <button
                    onClick={() => setShowPrompt(false)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-muted transition hover:text-foreground"
                  >
                    Agora nao
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSubscribed && (
        <button
          onClick={unsubscribe}
          className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-muted transition hover:text-foreground"
          title="Desativar notificacoes push"
        >
          <BellOff className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Push ativo</span>
        </button>
      )}
    </>
  )
}
