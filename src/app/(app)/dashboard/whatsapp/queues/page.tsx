'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueueManager } from '@/components/wa/QueueManager'

interface Queue {
  id: string
  user_id: string
  name: string
  color: string
  distribution: string
  max_load: number
  greeting_message?: string
  out_of_hours_message?: string
  business_hours?: Record<string, unknown>
  created_at: string
}

export default function QueuesPage() {
  const [queues, setQueues] = useState<Queue[]>([])

  const fetchQueues = useCallback(async () => {
    try {
      const response = await fetch('/api/wa/queues')
      const data = await response.json()
      if (data.queues) {
        setQueues(data.queues)
      }
    } catch (error) {
      console.error('Error fetching queues:', error)
    }
  }, [])

  useEffect(() => {
    fetchQueues()
  }, [fetchQueues])

  const handleCreateQueue = async (data: { name: string; color: string; max_load: number }) => {
    try {
      const response = await fetch('/api/wa/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        fetchQueues()
      }
    } catch (error) {
      console.error('Error creating queue:', error)
    }
  }

  const handleUpdateQueue = async (id: string, data: Partial<Queue>) => {
    try {
      const response = await fetch('/api/wa/queues', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      })

      if (response.ok) {
        fetchQueues()
      }
    } catch (error) {
      console.error('Error updating queue:', error)
    }
  }

  const handleDeleteQueue = async (id: string) => {
    if (!confirm('Deletar esta fila? Esta ação não pode ser desfeita.')) return

    try {
      await fetch(`/api/wa/queues?id=${id}`, { method: 'DELETE' })
      fetchQueues()
    } catch (error) {
      console.error('Error deleting queue:', error)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Filas de Atendimento</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Organize suas conversas em filas para melhor atendimento
        </p>
      </div>

      <QueueManager
        queues={queues}
        onCreateQueue={handleCreateQueue}
        onUpdateQueue={handleUpdateQueue}
        onDeleteQueue={handleDeleteQueue}
      />
    </div>
  )
}
