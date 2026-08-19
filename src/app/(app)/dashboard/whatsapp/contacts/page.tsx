'use client'

import { useState, useEffect, useCallback } from 'react'
import { ContactList } from '@/components/wa/ContactList'
import { Plus, X, Save, Users } from 'lucide-react'

interface Contact {
  id: string
  user_id: string
  phone: string
  name?: string
  push_name?: string
  avatar_url?: string
  email?: string
  tags?: string[]
  is_group: boolean
  created_at: string
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingContact, setEditingContact] = useState<Partial<Contact>>({})

  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch('/api/wa/contacts')
      const data = await response.json()
      if (data.contacts) {
        setContacts(data.contacts)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const handleCreateContact = () => {
    setEditingContact({ phone: '', name: '', email: '', tags: [] })
    setIsEditing(true)
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setIsEditing(true)
  }

  const handleSaveContact = async () => {
    if (!editingContact.phone) return

    try {
      const response = await fetch('/api/wa/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingContact),
      })

      if (response.ok) {
        setIsEditing(false)
        setEditingContact({})
        fetchContacts()
      }
    } catch (error) {
      console.error('Error saving contact:', error)
    }
  }

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Deletar contato ${contact.name || contact.phone}?`)) return

    try {
      await fetch(`/api/wa/contacts?id=${contact.id}`, { method: 'DELETE' })
      fetchContacts()
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }

  const handleStartChat = (contact: Contact) => {
    window.location.href = `/dashboard/whatsapp/chats`
  }

  return (
    <div className="flex h-full">
      <div className="w-96 border-r border-zinc-800 flex-shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-100">Contatos</h2>
            <button
              onClick={handleCreateContact}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo
            </button>
          </div>
        </div>
        <ContactList
          contacts={contacts}
          onSelectContact={handleEditContact}
          onStartChat={handleStartChat}
          onEdit={handleEditContact}
          onDelete={handleDeleteContact}
        />
      </div>

      <div className="flex-1">
        {isEditing ? (
          <div className="p-6 max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-zinc-100">
                {editingContact.id ? 'Editar Contato' : 'Novo Contato'}
              </h3>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditingContact({})
                }}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Telefone *</label>
                <input
                  type="text"
                  value={editingContact.phone || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                  placeholder="5511999999999"
                  className="w-full px-3 py-2 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Nome</label>
                <input
                  type="text"
                  value={editingContact.name || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="Nome do contato"
                  className="w-full px-3 py-2 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Email</label>
                <input
                  type="email"
                  value={editingContact.email || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <button
                onClick={handleSaveContact}
                disabled={!editingContact.phone}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {editingContact.id ? 'Salvar Alterações' : 'Criar Contato'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">
                Selecione um contato
              </h3>
              <p className="text-sm text-zinc-500">
                Escolha um contato ao lado ou crie um novo
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
