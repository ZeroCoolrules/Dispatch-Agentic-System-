import React, { useState } from 'react';
import { Send, Phone, ArrowRight, Terminal, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';

interface TraceLog {
  id: string;
  time: string;
  type: 'info' | 'ai' | 'tool' | 'success' | 'warning';
  message: string;
}

interface WebhookSimulatorProps {
  onRefreshData: () => void;
  activePhoneNumber: string;
  setActivePhoneNumber: (phone: string) => void;
}

const QUICK_SMS_TEMPLATES = [
  { label: 'Book Plumbing', text: 'Hi, I need someone to look at a plumbing leak. Can we do Tuesday July 7 at 10 AM?' },
  { label: 'Book HVAC', text: 'I need HVAC maintenance on Tuesday July 7 at 2 PM. Name is Ethan Hunt' },
  { label: 'Upset Client', text: 'I want a refund. Your service sucks, and I am calling my lawyer!' },
  { label: 'Opt-out Stop', text: 'STOP' },
  { label: 'Ask Question', text: 'What services do you offer and what are the rules?' }
];

const QUICK_CALL_TEMPLATES = [
  { label: 'Plumbing Request', text: 'Hello, looking for an electrical diagnostic or plumbing service tomorrow' },
  { label: 'Angry Customer', text: 'I am so mad, I need to talk to a manager immediately, refund me!' },
  { label: 'Disconnected Call', text: '' }
];

export const WebhookSimulator: React.FC<WebhookSimulatorProps> = ({ onRefreshData, activePhoneNumber, setActivePhoneNumber }) => {
  const [phone, setPhone] = useState(activePhoneNumber || '+13105554421');
  const [smsText, setSmsText] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [loading, setLoading] = useState(false);
  const [simMode, setSimMode] = useState<'sms' | 'voice'>('sms');
  const [traces, setTraces] = useState<TraceLog[]>([
    { id: '1', time: new Date().toLocaleTimeString(), type: 'info', message: 'Twilio Webhook Simulator loaded. Listening on /api/twilio/sms' }
  ]);

  const addTrace = (type: TraceLog['type'], message: string) => {
    setTraces(prev => [
      {
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        type,
        message
      },
      ...prev
    ]);
  };

  const handleSendSMS = async (e?: React.FormEvent, textOverride?: string) => {
    if (e) e.preventDefault();
    const finalSMS = textOverride || smsText;
    if (!finalSMS.trim()) return;

    setLoading(true);
    setActivePhoneNumber(phone);
    addTrace('info', `[Twilio Webhook] Inbound SMS from ${phone} -> Body: "${finalSMS}"`);

    try {
      const res = await fetch('/api/simulator/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, text: finalSMS })
      });

      const data = await res.json();
      if (data.success) {
        addTrace('ai', `[Gemini Agent] Reasoning processed successfully.`);
        
        // Simulating the internal tool logs
        if (finalSMS.toLowerCase().includes('stop') || finalSMS.toLowerCase().includes('cancel')) {
          addTrace('warning', `[Compliance Gate] Opt-Out detected! Updated lead status to LOST.`);
        } else if (finalSMS.toLowerCase().includes('plumb') || finalSMS.toLowerCase().includes('leak')) {
          addTrace('tool', `[Tool Call] checkAvailability() -> Found slots`);
          if (finalSMS.toLowerCase().includes('confirm') || finalSMS.toLowerCase().includes('yes') || finalSMS.toLowerCase().includes('10')) {
            addTrace('success', `[Tool Call] createAppointment() -> Booked for Tuesday July 7 @ 10:00 AM`);
          }
        } else if (finalSMS.toLowerCase().includes('refund') || finalSMS.toLowerCase().includes('suck')) {
          addTrace('warning', `[Tool Call] escalateToHuman() -> Created handoff ID`);
        }

        addTrace('success', `[Twilio Webhook] Outbound TwiML SMS reply dispatched: "${data.reply}"`);
        setSmsText('');
        onRefreshData();
      } else {
        addTrace('warning', `Error: ${data.error}`);
      }
    } catch (err) {
      addTrace('warning', `Network/Server Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateCall = async (e?: React.FormEvent, speechOverride?: string) => {
    if (e) e.preventDefault();
    const finalSpeech = speechOverride !== undefined ? speechOverride : speechText;

    setLoading(true);
    setActivePhoneNumber(phone);
    addTrace('info', `[Twilio Voice Webhook] Inbound phone call from ${phone}.`);
    if (finalSpeech) {
      addTrace('info', `[Speech Transcribed] Speech: "${finalSpeech}"`);
    } else {
      addTrace('warning', `[Silence] No Speech Result received.`);
    }

    try {
      const res = await fetch('/api/simulator/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, speechText: finalSpeech })
      });

      const data = await res.json();
      if (data.success) {
        const result = data.result;
        addTrace('ai', `[Voice Agent] Processing speech logic.`);
        
        if (result.action === 'transcribe_and_route') {
          addTrace('warning', `[Escalation Gateway] Direct Routing to Human Support Queue!`);
          addTrace('success', `[TwiML Responded] Say: "${result.responseText}" & Enqueue.`);
        } else {
          addTrace('success', `[TwiML Responded] Say: "${result.responseText}" & Gather.`);
        }
        setSpeechText('');
        onRefreshData();
      } else {
        addTrace('warning', `Error: ${data.error}`);
      }
    } catch (err) {
      addTrace('warning', `Network/Server Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-full flex flex-col" id="simulator-container">
      {/* Simulator Header */}
      <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-sans font-semibold text-slate-100 text-sm tracking-wide uppercase">
            Twilio Dispatch Simulator
          </span>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          <button
            onClick={() => setSimMode('sms')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              simMode === 'sms' ? 'bg-slate-900 text-amber-400 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="sim-sms-tab"
          >
            SMS Webhook
          </button>
          <button
            onClick={() => setSimMode('voice')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              simMode === 'voice' ? 'bg-slate-900 text-amber-400 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="sim-voice-tab"
          >
            Voice Call
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Mock Phone configuration */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
            Mock Customer Phone Number
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setActivePhoneNumber(e.target.value);
              }}
              className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="+13105554421"
              id="sim-phone-input"
            />
          </div>
        </div>

        {simMode === 'sms' ? (
          /* SMS SIMULATOR CONTENT */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-amber-500/90 uppercase tracking-wider block">
                Quick Test Templates (Click to send instantly)
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_SMS_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendSMS(undefined, tmpl.text)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs text-left hover:border-amber-500 hover:bg-slate-900 transition-colors cursor-pointer"
                    id={`quick-sms-${idx}`}
                  >
                    <span className="font-semibold text-amber-400 block">{tmpl.label}</span>
                    <span className="text-slate-400 block truncate max-w-[200px]">{tmpl.text}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendSMS} className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                Type Custom SMS Message
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  placeholder="Ask the AI for plumbing / HVAC / help..."
                  disabled={loading}
                  id="sim-sms-input"
                />
                <button
                  type="submit"
                  disabled={loading || !smsText.trim()}
                  className="px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 rounded-xl transition-all font-bold flex items-center justify-center cursor-pointer"
                  id="sim-sms-submit"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* VOICE CALL SIMULATOR CONTENT */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-amber-500/90 uppercase tracking-wider block">
                Quick Speech Triggers
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_CALL_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSimulateCall(undefined, tmpl.text)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs text-left hover:border-amber-500 hover:bg-slate-900 transition-colors cursor-pointer"
                    id={`quick-call-${idx}`}
                  >
                    <span className="font-semibold text-amber-400 block">{tmpl.label}</span>
                    <span className="text-slate-400 block truncate max-w-[200px]">
                      {tmpl.text ? `"${tmpl.text}"` : 'Direct Call/Silence'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSimulateCall} className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                Type Custom Customer Speech
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={speechText}
                  onChange={(e) => setSpeechText(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  placeholder="Hello, I would like to schedule a service..."
                  disabled={loading}
                  id="sim-voice-input"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all font-bold flex items-center justify-center cursor-pointer"
                  id="sim-voice-submit"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Live Webhook Trace Logs */}
        <div className="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden flex flex-col h-60">
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-mono font-semibold text-slate-300">Live Webhook Trace Log</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-2 select-text">
            {traces.map((trace) => (
              <div key={trace.id} className="flex gap-2 leading-relaxed">
                <span className="text-slate-600 shrink-0">[{trace.time}]</span>
                <span className={`shrink-0 font-bold ${
                  trace.type === 'ai' ? 'text-cyan-400' :
                  trace.type === 'tool' ? 'text-amber-400' :
                  trace.type === 'success' ? 'text-emerald-400' :
                  trace.type === 'warning' ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {trace.type === 'ai' ? '[Gemini AI]' :
                   trace.type === 'tool' ? '[Tool call]' :
                   trace.type === 'success' ? '[Success]' :
                   trace.type === 'warning' ? '[Warning]' : '[Webhook]'}
                </span>
                <span className="text-slate-300">{trace.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
