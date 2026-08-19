'use client'

import { useState } from 'react'
import { Search, User, Phone, Mail, MessageSquare, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface ContactListProps {
  contacts: Contact[]
  onSelectContact?: (contact: Contact) => void
  onStartChat?: (contact: Contact) => void
  onEdit?: (contact: Contact) => void
  onDelete?: (contact: Contact) => void
}

export function ContactList({
  contacts,
  onSelectContact,
  onStartChat,
  onEdit,
  onDelete,
}: ContactListProps) {
  const [search, setSearch] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  const filteredContacts = contacts.filter((contact) => {
    if (!search) return true
    const query = search.toLowerCase()
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.phone?.includes(query) ||
      contact.email?.toLowerCase().includes(query)
    )
  })

  const handleSelect = (contact: Contact) => {
    setSelectedContactId(contact.id)
    onSelectContact?.(contact)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contatos..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          {filteredContacts.length} contato{filteredContacts.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-4">
            <User className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">Nenhum contato encontrado</p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className={cn(
                'flex items-start gap-3 p-4 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors cursor-pointer',
                selectedContactId === contact.id && 'bg-zinc-800/80'
              )}
              onClick={() => handleSelect(contact)}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300 flex-shrink-0">
                {contact.name?.charAt(0).toUpperCase() || contact.phone?.charAt(0) || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-zinc-100 truncate">
                  {contact.name || contact.phone}
                </h4>

                <div className="space-y-0.5 mt-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Phone className="w-3 h-3" />
                    <span>{contact.phone}</span>
                  </div>
                  {contact.email && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                </div>

                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {contact.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartChat?.(contact)
                  }}
                  className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
                  title="Iniciar conversa"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit?.(contact)
                  }}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
