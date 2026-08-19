'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bot, Save, TestTube, Eye, EyeOff, Loader2 } from 'lucide-react'

interface AgentConfig {
  id?: string
  session_id: string
  is_enabled: boolean
  provider: string
  api_key: string | null
  model: string
  api_url: string | null
  system_prompt: string | null
  max_tokens: number
  temperature: number
  fallback_message: string
  human_handoff_message: string
}

interface Session {
  id: string
  name: string
  status: string
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-haiku-20240307'] },
  { value: 'google', label: 'Google', models: ['gemini-pro', 'gemini-1.5-flash'] },
  { value: 'nvidia', label: 'NVIDIA', models: ['z-ai/glm-5.2'] },
  { value: 'custom', label: 'Custom', models: [] },
]

export default function AgentConfigPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [config, setConfig] = useState<Partial<AgentConfig>>({})
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [testResult, setTestResult] = useState('')

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/wa/sessions')
      const data = await response.json()
      if (data.sessions) {
        setSessions(data.sessions)
        if (data.sessions.length > 0 && !selectedSessionId) {
          setSelectedSessionId(data.sessions[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    if (!selectedSessionId) return

    try {
      const response = await fetch(`/api/wa/agent/config?session_id=${selectedSessionId}`)
      const data = await response.json()
      if (data.config) {
        setConfig(data.config)
      } else {
        setConfig({
          session_id: selectedSessionId,
          is_enabled: false,
          provider: 'openai',
          model: 'gpt-4o',
          max_tokens: 1024,
          temperature: 0.7,
          fallback_message: 'Desculpe, não consegui processar. Um atendente humano irá ajudá-lo.',
          human_handoff_message: 'Vou transferir para um atendente humano.',
        })
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    }
  }, [selectedSessionId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    if (!selectedSessionId) return

    setSaving(true)
    try {
      const response = await fetch('/api/wa/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, session_id: selectedSessionId }),
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        alert('Configuração salva!')
      }
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testMessage || !selectedSessionId) return

    setTesting(true)
    setTestResult('')
    try {
      const response = await fetch('/api/wa/agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedSessionId,
          chat_jid: 'test@s.whatsapp.net',
          message: testMessage,
        }),
      })

      const data = await response.json()
      setTestResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setTestResult('Erro ao testar')
    } finally {
      setTesting(false)
    }
  }

  const selectedProvider = PROVIDERS.find(p => p.value === config.provider)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-8 h-8 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Agente IA</h1>
          <p className="text-sm text-zinc-400">Configure o assistente virtual para cada conexão</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="text-sm text-zinc-400 mb-2 block">Conexão WhatsApp</label>
        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name} ({session.status})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-100">Ativar Agente</h3>
            <button
              onClick={() => setConfig({ ...config, is_enabled: !config.is_enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.is_enabled ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.is_enabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <h3 className="font-medium text-zinc-100 mb-4">Provedor IA</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Provedor</label>
              <select
                value={config.provider || 'openai'}
                onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Modelo</label>
              {selectedProvider?.models.length ? (
                <select
                  value={config.model || ''}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {selectedProvider.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.model || ''}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  placeholder="nome-do-modelo"
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-zinc-400 mb-1 block">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.api_key || ''}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {config.provider === 'custom' && (
            <div className="mb-4">
              <label className="text-xs text-zinc-400 mb-1 block">API URL</label>
              <input
                type="text"
                value={config.api_url || ''}
                onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                placeholder="https://sua-api.com/v1/chat"
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Max Tokens</label>
              <input
                type="number"
                value={config.max_tokens || 1024}
                onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={config.temperature || 0.7}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <h3 className="font-medium text-zinc-100 mb-4">System Prompt</h3>
          <textarea
            value={config.system_prompt || ''}
            onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
            placeholder="Você é um assistente de vendas da empresa X. Seu objetivo é ajudar clientes..."
            rows={6}
            className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <h3 className="font-medium text-zinc-100 mb-4">Mensagens Padrão</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fallback (erro)</label>
              <input
                type="text"
                value={config.fallback_message || ''}
                onChange={(e) => setConfig({ ...config, fallback_message: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Handoff para humano</label>
              <input
                type="text"
                value={config.human_handoff_message || ''}
                onChange={(e) => setConfig({ ...config, human_handoff_message: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !selectedSessionId}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar Configuração
        </button>

        <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <h3 className="font-medium text-zinc-100 mb-4">Testar Agente</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Digite uma mensagem de teste..."
              className="flex-1 px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testMessage}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Testar
            </button>
          </div>
          {testResult && (
            <pre className="mt-3 p-3 bg-zinc-900 rounded-lg text-xs text-zinc-300 overflow-auto max-h-48">
              {testResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
