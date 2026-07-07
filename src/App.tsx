import React, { useState, useEffect } from 'react';
import { 
  Cpu, MessageSquare, Calendar as CalendarIcon, Users, SlidersHorizontal, 
  Bell, ArrowUpRight, CheckCircle2, ShieldAlert, AlertCircle, Phone, 
  Clock, LogOut, Send, Check, Shield, Lock, Sparkles, UserPlus,
  Volume2, VolumeX
} from 'lucide-react';
import { WebhookSimulator } from './components/WebhookSimulator.tsx';
import { CalendarPanel } from './components/CalendarPanel.tsx';
import { DashboardData, Conversation, Message, Lead, Client, Handoff, SystemSettings } from './types.ts';

export default function App() {
  // Main Data States
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'inbox' | 'schedule' | 'leads' | 'settings'>('overview');
  const [activePhone, setActivePhone] = useState<string>('+13105554421');
  const [loading, setLoading] = useState<boolean>(true);

  // Manual Reply states
  const [replyText, setReplyText] = useState<string>('');
  const [sendingReply, setSendingReply] = useState<boolean>(false);

  // Settings states (draft for editing)
  const [settingsForm, setSettingsForm] = useState<SystemSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // New Client Form
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [addingClient, setAddingClient] = useState(false);

  // Resolve handoff notes
  const [handoffNotes, setHandoffNotes] = useState<{[key: string]: string}>({});

  // Fetch complete data
  const fetchData = async () => {
    try {
      const res = await fetch('/api/db');
      const dbData: DashboardData = await res.json();
      setData(dbData);
      if (!settingsForm) {
        setSettingsForm(dbData.settings);
      }
    } catch (err) {
      console.error('Error polling database data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll data every 3 seconds for a real-time responsive dashboard
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Refs to track seen IDs for sound notifications
  const seenMessageIds = React.useRef<Set<string>>(new Set());
  const seenHandoffIds = React.useRef<Set<string>>(new Set());
  const initialLoadDone = React.useRef<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Sound playing function using Web Audio API
  const playSound = (type: 'message' | 'handoff', force: boolean = false) => {
    if (!soundEnabled && !force) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === 'message') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
        
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'handoff') {
        const now = ctx.currentTime;
        // Warm dramatic warning chord/beeps
        const frequencies = [440.00, 554.37, 659.25]; // A4, C#5, E5 (Major triad alert)
        
        frequencies.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          
          gain.gain.setValueAtTime(0.08, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.3);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.35);
        });
      }
    } catch (err) {
      console.error('Audio synthesis failed:', err);
    }
  };

  // Check for new messages or handoffs to play sounds
  useEffect(() => {
    if (!data) return;

    // Track only INBOUND messages
    const inboundMessages = data.messages.filter(m => m.direction === 'inbound');
    const currentMsgIds = new Set(inboundMessages.map(m => m.id));
    const currentPendingHandoffIds = new Set(
      data.handoffs.filter(h => h.status === 'pending').map(h => h.id)
    );

    if (!initialLoadDone.current) {
      // First data load: populate seen IDs without playing sound
      seenMessageIds.current = currentMsgIds;
      seenHandoffIds.current = currentPendingHandoffIds;
      initialLoadDone.current = true;
      return;
    }

    // Check for NEW inbound messages
    let hasNewInboundMessage = false;
    for (const id of currentMsgIds) {
      if (!seenMessageIds.current.has(id)) {
        hasNewInboundMessage = true;
        break;
      }
    }

    // Check for NEW pending handoffs
    let hasNewHandoff = false;
    for (const id of currentPendingHandoffIds) {
      if (!seenHandoffIds.current.has(id)) {
        hasNewHandoff = true;
        break;
      }
    }

    // Play sounds
    if (hasNewHandoff) {
      playSound('handoff');
    } else if (hasNewInboundMessage) {
      playSound('message');
    }

    // Update seen references
    seenMessageIds.current = currentMsgIds;
    seenHandoffIds.current = currentPendingHandoffIds;
  }, [data]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-slate-100 p-4">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 font-mono text-sm tracking-wider uppercase animate-pulse">
            Connecting to Agentic Dispatch System...
          </p>
        </div>
      </div>
    );
  }

  // Active elements
  const activeConversations = data.conversations || [];
  const selectedConversation = activeConversations.find(c => c.id === activePhone) || activeConversations[0];
  const activeHandoffs = data.handoffs?.filter(h => h.status === 'pending') || [];
  const currentMessages = selectedConversation ? data.messages.filter(m => m.conversationId === selectedConversation.id) : [];

  // Statistics
  const totalLeads = data.leads?.length || 0;
  const activeAppointmentsCount = data.appointments?.filter(a => a.status === 'confirmed').length || 0;
  const totalCalls = data.calls?.length || 0;
  const pendingHandoffsCount = activeHandoffs.length;

  // Handlers
  const handleSendManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !replyText.trim()) return;

    setSendingReply(true);
    try {
      const res = await fetch('/api/manual/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          text: replyText
        })
      });
      if (res.ok) {
        setReplyText('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to send manual reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleResolveHandoff = async (handoffId: string) => {
    try {
      const res = await fetch('/api/handoffs/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: handoffId,
          notes: handoffNotes[handoffId] || 'Resolved by human dispatcher.'
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to resolve handoff:', err);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
    }
  };

  const handleCreateAppointment = async (clientName: string, clientPhone: string, serviceType: string, startTime: string, notes?: string) => {
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, clientPhone, serviceType, startTime, notes })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to book appointment:', err);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) return;

    setAddingClient(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName,
          phone: newClientPhone,
          email: newClientEmail,
          notes: newClientNotes
        })
      });
      if (res.ok) {
        setNewClientName('');
        setNewClientPhone('');
        setNewClientEmail('');
        setNewClientNotes('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add client:', err);
    } finally {
      setAddingClient(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;

    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm)
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFormChange = (key: keyof SystemSettings, value: any) => {
    if (settingsForm) {
      setSettingsForm({ ...settingsForm, [key]: value });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col antialiased">
      {/* Sleek Header Command Center */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-slate-950 shadow-md">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans font-extrabold text-slate-100 text-lg tracking-tight uppercase">
                Agentic Dispatch System
              </h1>
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-mono uppercase font-bold tracking-wider">
                Enterprise v1.2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Live Webhook URL: <span className="text-amber-500/80 underline select-all">/api/twilio/sms</span>
            </p>
          </div>
        </div>

        {/* Real-time System Status Bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-slate-400">AI AGENT:</span>
            <span className="text-emerald-400 font-bold">READY</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300">JULY 7, 2026</span>
          </div>
          <button
            onClick={() => {
              const nextVal = !soundEnabled;
              setSoundEnabled(nextVal);
              if (nextVal) {
                setTimeout(() => playSound('message', true), 100);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-950/40 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
            id="btn-toggle-sound"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              {soundEnabled ? 'Sound On' : 'Muted'}
            </span>
          </button>
        </div>
      </header>

      {/* Modern Bento Statistics Bar */}
      <section className="px-6 pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Total Leads</span>
            <span className="font-sans font-extrabold text-slate-100 text-2xl block">{totalLeads}</span>
          </div>
          <ArrowUpRight className="w-5 h-5 text-amber-500" />
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Appointments Booked</span>
            <span className="font-sans font-extrabold text-slate-100 text-2xl block">{activeAppointmentsCount}</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Pending Escalations</span>
            <span className="font-sans font-extrabold text-rose-400 text-2xl block">{pendingHandoffsCount}</span>
          </div>
          <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Total Calls Logged</span>
            <span className="font-sans font-extrabold text-slate-100 text-2xl block">{totalCalls}</span>
          </div>
          <Phone className="w-5 h-5 text-slate-400" />
        </div>
      </section>

      {/* Main Grid Workspace */}
      <main className="flex-1 px-6 py-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: Interactive Twilio Simulator + Live Traces (Takes 4 columns on large screens) */}
        <section className="xl:col-span-4 h-full">
          <WebhookSimulator 
            onRefreshData={fetchData} 
            activePhoneNumber={activePhone} 
            setActivePhoneNumber={(phone) => {
              setActivePhone(phone);
              // Auto-switch to inbox if active phone clicked
              setActiveTab('inbox');
            }}
          />
        </section>

        {/* Right Side: Host Central Command Console (Takes 8 columns) */}
        <section className="xl:col-span-8 space-y-6">
          {/* Active Handoff Panel (Shows immediately if there's an escalation) */}
          {activeHandoffs.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-500/20 p-5 rounded-2xl space-y-4" id="escalation-alert-panel">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                <h3 className="font-sans font-bold text-rose-300">AI-Triggered Human Handoffs ({activeHandoffs.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeHandoffs.map(handoff => (
                  <div key={handoff.id} className="p-4 bg-slate-950 border border-rose-500/10 rounded-xl space-y-3" id={`handoff-${handoff.id}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-100 text-sm block">{handoff.leadName}</span>
                        <span className="text-xs text-rose-400 font-mono block">{handoff.phone}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[10px] font-mono uppercase font-bold">
                        {handoff.reason}
                      </span>
                    </div>

                    {handoff.notes && (
                      <p className="text-xs text-slate-400 italic">" {handoff.notes} "</p>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Resolution notes..."
                        value={handoffNotes[handoff.id] || ''}
                        onChange={(e) => setHandoffNotes({ ...handoffNotes, [handoff.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        id={`handoff-notes-input-${handoff.id}`}
                      />
                      <button
                        onClick={() => handleResolveHandoff(handoff.id)}
                        className="px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        id={`handoff-resolve-btn-${handoff.id}`}
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Sub-Tabs */}
          <div className="flex border-b border-slate-800/80 gap-1 pb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              id="tab-overview"
            >
              <Sparkles className="w-3.5 h-3.5" /> Overview
            </button>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'inbox'
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              id="tab-inbox"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Live Inbox
              {activeConversations.some(c => c.unreadCount > 0) && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'schedule'
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              id="tab-schedule"
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Dispatch Planner
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'leads'
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              id="tab-leads"
            >
              <Users className="w-3.5 h-3.5" /> Leads & Clients
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              id="tab-settings"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Settings
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div className="space-y-6">
            {/* 1. OVERVIEW / COMMAND CENTER */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Active Agent Actions Logs */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-amber-500" />
                      <h2 className="font-sans font-bold text-slate-100">AI Dispatch Engine Audits</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    {data.agentActions.length === 0 ? (
                      <p className="text-sm text-slate-500">No actions logged yet. Interact with the simulator to trigger logs!</p>
                    ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {data.agentActions.slice().reverse().map((act) => (
                          <div key={act.id} className="flex items-start gap-3 border-b border-slate-800/40 pb-3 last:border-0 last:pb-0">
                            <span className="text-[10px] font-mono text-slate-500 pt-0.5">{new Date(act.timestamp).toLocaleTimeString()}</span>
                            <div>
                              <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded mr-2 ${
                                act.type === 'sms_received' ? 'bg-indigo-500/10 text-indigo-400' :
                                act.type === 'sms_sent' ? 'bg-amber-500/10 text-amber-400' :
                                act.type === 'appointment_created' ? 'bg-emerald-500/10 text-emerald-400' :
                                act.type === 'handoff' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {act.type.toUpperCase()}
                              </span>
                              <span className="text-sm text-slate-300 font-sans">{act.description}</span>
                              {act.payload && (
                                <pre className="text-[10px] bg-slate-950/80 p-2 rounded-lg text-slate-400 font-mono mt-1.5 border border-slate-800/40 max-w-full overflow-x-auto">
                                  {act.payload}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Simulated Recent Calls list */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-amber-500" />
                      <h2 className="font-sans font-bold text-slate-100">Live Voice / Call Registries</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    {data.calls.length === 0 ? (
                      <p className="text-sm text-slate-500">No calls registered yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.calls.slice().reverse().map((call) => (
                          <div key={call.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-sm text-slate-300">{call.phone}</span>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                                call.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                                call.sentiment === 'angry' ? 'bg-rose-500/10 text-rose-400 animate-pulse' : 'bg-slate-800 text-slate-400'
                              }`}>
                                Sentiment: {call.sentiment}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-semibold italic">"{call.transcription}"</p>
                            <p className="text-xs text-slate-500 font-sans">{call.summary}</p>
                            <span className="text-[10px] font-mono text-slate-600 block pt-1">Logged: {new Date(call.createdAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. LIVE INBOX & CONVERSATIONS */}
            {activeTab === 'inbox' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Conversations Sidebar (Left) */}
                <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 h-[500px] overflow-y-auto">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Conversations</h3>
                  {activeConversations.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2">No active conversations found.</p>
                  ) : (
                    <div className="space-y-1">
                      {activeConversations.map(conv => (
                        <button
                          key={conv.id}
                          onClick={() => setActivePhone(conv.phone)}
                          className={`w-full p-3 rounded-xl flex flex-col text-left gap-1 transition-all cursor-pointer ${
                            activePhone === conv.phone
                              ? 'bg-amber-500/10 border border-amber-500/20 shadow-sm'
                              : 'bg-transparent border border-transparent hover:bg-slate-950/40'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="font-bold text-slate-200 text-sm">{conv.participantName}</span>
                            {conv.unreadCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-full text-[9px] font-bold">
                                {conv.unreadCount} new
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">{conv.phone}</span>
                          <span className={`text-[10px] font-bold uppercase ${
                            conv.status === 'human_handoff' ? 'text-rose-400' : 'text-slate-500'
                          }`}>
                            {conv.status === 'human_handoff' ? '● Human Handoff' : '● AI Active'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conversation Chat Feed (Right) */}
                <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[500px]">
                  {selectedConversation ? (
                    <>
                      {/* Selected participant header */}
                      <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-bold text-slate-100">{selectedConversation.participantName}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                              selectedConversation.status === 'human_handoff' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {selectedConversation.status === 'human_handoff' ? 'Escalated' : 'AI Agent Active'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">{selectedConversation.phone}</span>
                        </div>
                      </div>

                      {/* Chat Messages flow */}
                      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-950/20">
                        {currentMessages.length === 0 ? (
                          <div className="text-center py-20 text-slate-600">No messages found.</div>
                        ) : (
                          currentMessages.map(msg => {
                            const isAI = msg.sender === 'ai';
                            const isHuman = msg.sender === 'human';
                            const isInbound = msg.direction === 'inbound';
                            
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col max-w-[75%] ${
                                  isInbound ? 'mr-auto items-start' : 'ml-auto items-end'
                                }`}
                                id={`chat-msg-${msg.id}`}
                              >
                                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1 px-1">
                                  {isAI ? '🤖 Dispatch AI' : isHuman ? '🧑‍💻 Human override' : '👤 Customer'}
                                </span>
                                <div
                                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                    isInbound
                                      ? 'bg-slate-900 text-slate-100 border border-slate-800'
                                      : isHuman
                                      ? 'bg-emerald-600 text-slate-950 font-semibold shadow-md'
                                      : 'bg-amber-500 text-slate-950 font-medium'
                                  }`}
                                >
                                  {msg.text}
                                </div>
                                <span className="text-[9px] text-slate-600 font-mono mt-1 px-1">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Manual Reply Form */}
                      <form onSubmit={handleSendManualReply} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-3">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type an SMS reply (takes over conversation and overrides AI)..."
                          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                          id="manual-reply-input"
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !replyText.trim()}
                          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                          id="manual-reply-submit"
                        >
                          <Send className="w-3.5 h-3.5" /> Overwrite
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm">
                      Select a conversation to begin dispatching.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. CALENDAR BOARD / SCHEDULE */}
            {activeTab === 'schedule' && (
              <CalendarPanel
                appointments={data.appointments}
                availability={data.availability}
                onCancelAppointment={handleCancelAppointment}
                onCreateAppointment={handleCreateAppointment}
              />
            )}

            {/* 4. LEADS & CLIENTS */}
            {activeTab === 'leads' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Leads lists */}
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 bg-slate-950 border-b border-slate-800">
                    <h2 className="font-sans font-bold text-slate-100">Hot Leads Dispatch Queue</h2>
                  </div>
                  <div className="p-6 overflow-x-auto">
                    {data.leads.length === 0 ? (
                      <p className="text-sm text-slate-500">No leads found in system.</p>
                    ) : (
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/60 font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Source</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Registered</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-sans">
                          {data.leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-950/40" id={`lead-row-${lead.id}`}>
                              <td className="p-3 font-semibold text-slate-200">{lead.name}</td>
                              <td className="p-3 font-mono">{lead.phone}</td>
                              <td className="p-3">{lead.source}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                  lead.status === 'new' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  lead.status === 'appointment_booked' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  lead.status === 'escalated' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700/60'
                                }`}>
                                  {lead.status}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Clients registration */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Create client Form */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-amber-500" />
                      <h2 className="font-sans font-bold text-slate-100">Add Premium Client File</h2>
                    </div>
                    <form onSubmit={handleAddClient} className="p-6 space-y-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Client Name</label>
                        <input
                          type="text"
                          required
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                          placeholder="Alice Vance"
                          id="client-name-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone Number</label>
                        <input
                          type="text"
                          required
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500"
                          placeholder="+14155552671"
                          id="client-phone-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address (Optional)</label>
                        <input
                          type="email"
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500"
                          placeholder="alice@example.com"
                          id="client-email-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Preferences</label>
                        <textarea
                          value={newClientNotes}
                          onChange={(e) => setNewClientNotes(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                          placeholder="Prefers residential consults, VIP customer..."
                          id="client-notes-input"
                        ></textarea>
                      </div>

                      <button
                        type="submit"
                        disabled={addingClient || !newClientName.trim() || !newClientPhone.trim()}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-xl text-sm transition-all cursor-pointer"
                        id="client-submit-btn"
                      >
                        {addingClient ? 'Saving File...' : 'Create Client File'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* 5. CORE SETTINGS / AI CONFIGURATION */}
            {activeTab === 'settings' && settingsForm && (
              <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-6">
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-amber-500" />
                    <h2 className="font-sans font-bold text-slate-100">Compliance & Dispatch AI Tuning</h2>
                  </div>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    id="btn-save-settings"
                  >
                    {savingSettings ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* AI prompts */}
                  <div className="space-y-4 md:col-span-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Central Scheduling AI System prompt
                        </label>
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/10 rounded text-[9px] font-mono">
                          SYSTEM ENFORCED
                        </span>
                      </div>
                      <textarea
                        value={settingsForm.systemPrompt}
                        onChange={(e) => handleFormChange('systemPrompt', e.target.value)}
                        rows={6}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-sans focus:outline-none focus:border-amber-500 leading-relaxed"
                        id="settings-prompt-textarea"
                      ></textarea>
                    </div>
                  </div>

                  {/* Core config toggles */}
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-200 text-sm block">Allow Autonomous AI Responses</span>
                          <span className="text-[11px] text-slate-500 block">AI chats directly with webhooks. If disabled, all goes to human queue.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settingsForm.allowAIReplies}
                            onChange={(e) => handleFormChange('allowAIReplies', e.target.checked)}
                            className="sr-only peer"
                            id="settings-allow-replies-checkbox"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Default Consultation Length (Minutes)
                      </label>
                      <input
                        type="number"
                        value={settingsForm.appointmentDurationMinutes}
                        onChange={(e) => handleFormChange('appointmentDurationMinutes', parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500"
                        id="settings-duration-input"
                      />
                    </div>
                  </div>

                  {/* Anti-Spam & Opt-out Compliance */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Anti-Spam Blocked words (Comma separated)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.blockedWords.join(', ')}
                        onChange={(e) => handleFormChange('blockedWords', e.target.value.split(',').map(s => s.trim()))}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-sans focus:outline-none focus:border-amber-500"
                        placeholder="scam, hack, free"
                        id="settings-blocked-words-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Compliance Opt-Out Phrases (SMS stopping triggers)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.optOutStrings.join(', ')}
                        onChange={(e) => handleFormChange('optOutStrings', e.target.value.split(',').map(s => s.trim()))}
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-sans focus:outline-none focus:border-amber-500"
                        placeholder="stop, cancel, quit"
                        id="settings-opt-out-input"
                      />
                    </div>
                  </div>

                  {/* Notification Sounds & Real-time Diagnostics */}
                  <div className="space-y-4 md:col-span-2 border-t border-slate-800/80 pt-6">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Notification Audio Settings & Real-time Diagnostics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-200 text-sm block">Subtle Notification Chime</span>
                          <span className="text-[11px] text-slate-500 block">
                            Plays automatically on new inbound client messages arriving in the Live Inbox.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => playSound('message', true)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 hover:border-amber-500/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 self-start md:self-center"
                          id="btn-test-chime"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> Test Chime
                        </button>
                      </div>

                      <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-200 text-sm block">Human Handoff Alert Chime</span>
                          <span className="text-[11px] text-slate-500 block">
                            Plays instantly when an AI conversation escalates to a pending handoff.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => playSound('handoff', true)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 hover:border-rose-500/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 self-start md:self-center"
                          id="btn-test-warning"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-rose-400" /> Test Warning
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Modern minimal footer */}
      <footer className="py-6 px-6 bg-slate-900 border-t border-slate-800/80 text-center text-xs font-mono text-slate-500 mt-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <p>Apex Dispatch Core • Confirmed compliant for SMS delivery carriers.</p>
        <p>Database synchronization frequency: <span className="text-emerald-500 font-bold">100% Real-time</span></p>
      </footer>
    </div>
  );
}
