

import { useState } from "react"
import { Users, Loader2, AlertTriangle, RotateCcw, Mic, MicOff, Volume2, VolumeX, Video, MonitorPlay } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChannelPicker } from "@/components/channel-picker"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"

interface MemberInfo {
  id: string
  username: string
  tag: string
  mute: boolean
  deaf: boolean
  streaming: boolean
  selfVideo: boolean
}

type Phase = "idle" | "results" | "error"

export default function PaginaListarCall() {
  const { activeToken } = useTokens()
  const [channelId, setChannelId] = useState("")
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [channelName, setChannelName] = useState("")
  const [members, setMembers] = useState<MemberInfo[]>([])

  const handleSearch = async () => {
    if (!activeToken || !channelId.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await api.runTool("call-utils", {
        tokenId: activeToken.id,
        action: "list-members",
        channelId: channelId.trim(),
      })
      const data = res.data as { channel: string; totalMembers: number; members: MemberInfo[] }
      setChannelName(data.channel)
      setMembers(data.members)
      setPhase("results")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro")
      setPhase("error")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => { setPhase("idle"); setError(""); setMembers([]) }

  if (phase === "idle") {
    return (
      <div className="space-y-6">
        {!activeToken && (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
            <AlertTriangle size={18} className="shrink-0 text-yellow-500" />
            <span className="text-sm text-yellow-400">Conecte uma conta primeiro</span>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
              <Users size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Listar Membros da Call</h2>
              <p className="text-xs text-muted-foreground">Lista todos os membros em um canal de voz com seus estados</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Canal de Voz</label>
            <div className="flex gap-2">
              <Input placeholder="ID do canal de voz" value={channelId} onChange={(e) => setChannelId(e.target.value)} className="h-11 border-border bg-secondary/40 font-mono text-sm" disabled={!activeToken} />
              <ChannelPicker onSelect={setChannelId} disabled={!activeToken} type="voice" />
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={handleSearch} disabled={loading || !activeToken || !channelId.trim()} className="h-11 w-full bg-cyan-600 text-white hover:bg-cyan-700">
              {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Users size={18} className="mr-2" />}
              Listar Membros
            </Button>
          </div>
        </div>
      </div>
    )
  }
  if (phase === "results") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{channelName}</h2>
            <p className="text-sm text-muted-foreground">{members.length} membros na call</p>
          </div>
          <Button onClick={handleReset} variant="outline" className="h-10"><RotateCcw size={16} className="mr-2" /> Voltar</Button>
        </div>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-4 rounded-lg border border-border bg-card/40 p-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{m.tag}</p>
                <p className="text-xs text-muted-foreground font-mono">{m.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.mute ? <span title="Mutado"><MicOff size={16} className="text-red-400" /></span> : <span title="Não mutado"><Mic size={16} className="text-green-400" /></span>}
                {m.deaf ? <span title="Ensurdecido"><VolumeX size={16} className="text-red-400" /></span> : <span title="Não ensurdecido"><Volume2 size={16} className="text-green-400" /></span>}
                {m.streaming && <span title="Streaming"><MonitorPlay size={16} className="text-purple-400" /></span>}
                {m.selfVideo && <span title="Vídeo"><Video size={16} className="text-blue-400" /></span>}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="rounded-lg border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">Nenhum membro na call</div>
          )}
        </div>
      </div>
    )
  }
  if (phase === "error") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertTriangle size={24} className="text-red-400" /></div>
            <div className="flex-1"><h3 className="text-lg font-semibold text-red-400">Erro</h3><p className="text-sm text-muted-foreground">{error}</p></div>
            <Button onClick={handleReset} variant="outline" className="h-10"><RotateCcw size={16} className="mr-2" /> Tentar novamente</Button>
          </div>
        </div>
      </div>
    )
  }
  return null
}
