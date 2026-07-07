import fs from 'fs';
import path from 'path';
import { DashboardData, Client, PhoneNumber, Lead, Conversation, Message, Call, Appointment, AvailabilitySlot, AgentAction, Reminder, Handoff, SystemSettings } from '../src/types.js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const defaultSettings: SystemSettings = {
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '+15550192000',
  systemPrompt: `You are "DispatchBot", the friendly and highly efficient AI Scheduling Assistant for Apex Premium Services.
Your primary goal is to book appointments for leads and answer questions.

Follow these absolute rules when conversing with leads:
1. GREET: Greet them professionally and ask which of our services they are looking for.
2. SERVICES: Our available services are: Plumbing Consultation, HVAC Maintenance, and Electrical Diagnostic.
3. LOCATION/METHOD: Confirm their location (e.g., "Will this be at our main clinic or on-site?").
4. CHECK AVAILABILITY: Always call the tool 'checkAvailability' or find a slot before confirming.
5. QUOTE RULES: Tell them standard consultation length is 60 minutes and rules (e.g. 24-hour cancellation notice).
6. BOOK: Once they select a day and time, book the appointment immediately using 'createAppointment' and send confirmation.
7. ESCALATE: If they are angry, demand a refund, ask highly risky questions, or when you are confused, trigger 'escalateToHuman' immediately.

Keep your replies short, friendly, and formatted for SMS (under 160 characters when possible). No markdown or emojis in raw SMS unless appropriate.`,
  blockedWords: ['scam', 'spam', 'hack', 'fraud', 'illegal'],
  optOutStrings: ['stop', 'unsubscribe', 'cancel', 'quit'],
  allowAIReplies: true,
  appointmentDurationMinutes: 60,
  availableServices: ['Plumbing Consultation', 'HVAC Maintenance', 'Electrical Diagnostic']
};

const defaultAvailability: AvailabilitySlot[] = [
  // Mon (1) to Fri (5), 9:00 to 17:00
  { id: 'av1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
  { id: 'av2', dayOfWeek: 1, startTime: '10:00', endTime: '11:00' },
  { id: 'av3', dayOfWeek: 1, startTime: '11:00', endTime: '12:00' },
  { id: 'av4', dayOfWeek: 1, startTime: '13:00', endTime: '14:00' },
  { id: 'av5', dayOfWeek: 1, startTime: '14:00', endTime: '15:00' },
  { id: 'av6', dayOfWeek: 1, startTime: '15:00', endTime: '16:00' },
  { id: 'av7', dayOfWeek: 1, startTime: '16:00', endTime: '17:00' },

  { id: 'av8', dayOfWeek: 2, startTime: '09:00', endTime: '10:00' },
  { id: 'av9', dayOfWeek: 2, startTime: '10:00', endTime: '11:00' },
  { id: 'av10', dayOfWeek: 2, startTime: '11:00', endTime: '12:00' },
  { id: 'av11', dayOfWeek: 2, startTime: '13:00', endTime: '14:00' },
  { id: 'av12', dayOfWeek: 2, startTime: '14:00', endTime: '15:00' },
  { id: 'av13', dayOfWeek: 2, startTime: '15:00', endTime: '16:00' },
  { id: 'av14', dayOfWeek: 2, startTime: '16:00', endTime: '17:00' },

  { id: 'av15', dayOfWeek: 3, startTime: '09:00', endTime: '10:00' },
  { id: 'av16', dayOfWeek: 3, startTime: '10:00', endTime: '11:00' },
  { id: 'av17', dayOfWeek: 3, startTime: '11:00', endTime: '12:00' },
  { id: 'av18', dayOfWeek: 3, startTime: '13:00', endTime: '14:00' },
  { id: 'av19', dayOfWeek: 3, startTime: '14:00', endTime: '15:00' },
  { id: 'av20', dayOfWeek: 3, startTime: '15:00', endTime: '16:00' },
  { id: 'av21', dayOfWeek: 3, startTime: '16:00', endTime: '17:00' },

  { id: 'av22', dayOfWeek: 4, startTime: '09:00', endTime: '10:00' },
  { id: 'av23', dayOfWeek: 4, startTime: '10:00', endTime: '11:00' },
  { id: 'av24', dayOfWeek: 4, startTime: '11:00', endTime: '12:00' },
  { id: 'av25', dayOfWeek: 4, startTime: '13:00', endTime: '14:00' },
  { id: 'av26', dayOfWeek: 4, startTime: '14:00', endTime: '15:00' },
  { id: 'av27', dayOfWeek: 4, startTime: '15:00', endTime: '16:00' },
  { id: 'av28', dayOfWeek: 4, startTime: '16:00', endTime: '17:00' },

  { id: 'av29', dayOfWeek: 5, startTime: '09:00', endTime: '10:00' },
  { id: 'av30', dayOfWeek: 5, startTime: '10:00', endTime: '11:00' },
  { id: 'av31', dayOfWeek: 5, startTime: '11:00', endTime: '12:00' },
  { id: 'av32', dayOfWeek: 5, startTime: '13:00', endTime: '14:00' },
  { id: 'av33', dayOfWeek: 5, startTime: '14:00', endTime: '15:00' },
  { id: 'av34', dayOfWeek: 5, startTime: '15:00', endTime: '16:00' },
  { id: 'av35', dayOfWeek: 5, startTime: '16:00', endTime: '17:00' },
];

const initialData: DashboardData = {
  clients: [
    { id: 'c1', name: 'Alice Vance', phone: '+14155552671', email: 'alice@example.com', notes: 'VIP residential customer, prefers quick service', createdAt: '2026-06-01T10:00:00Z' },
    { id: 'c2', name: 'Bob Thorne', phone: '+12125559834', email: 'bob@example.com', notes: 'Commercial provider, needs invoicing', createdAt: '2026-06-15T14:30:00Z' }
  ],
  phoneNumbers: [
    { id: 'p1', number: '+15550192000', type: 'tracking', status: 'active', label: 'Primary Dispatch AI Agent' },
    { id: 'p2', number: '+15550239000', type: 'forwarded', status: 'active', label: 'Tech Emergency Forward Line' }
  ],
  leads: [
    { id: 'l1', name: 'Charlie Day', phone: '+13105554421', email: 'charlie@example.com', source: 'SMS', status: 'new', notes: 'Looking for a Plumbing Consultation ASAP.', createdAt: '2026-07-06T15:20:00Z', updatedAt: '2026-07-06T15:20:00Z' },
    { id: 'l2', name: 'Ethan Hunt', phone: '+16505557731', email: 'ethan@example.com', source: 'SMS', status: 'appointment_booked', notes: 'Booked HVAC Maintenance via AI.', createdAt: '2026-07-06T09:15:00Z', updatedAt: '2026-07-06T11:45:00Z' },
    { id: 'l3', name: 'Diana Prince', phone: '+14085558812', email: 'diana@example.com', source: 'Voice Call', status: 'contacted', notes: 'Interested in Electrical Diagnostics. Call disconnected.', createdAt: '2026-07-05T11:00:00Z', updatedAt: '2026-07-05T11:02:00Z' },
    { id: 'l4', name: 'Grumpy Joe', phone: '+17185550099', email: 'joe@example.com', source: 'SMS', status: 'escalated', notes: 'Angry about prices, escalated to humans.', createdAt: '2026-07-06T18:00:00Z', updatedAt: '2026-07-06T18:10:00Z' }
  ],
  conversations: [
    { id: '+13105554421', participantName: 'Charlie Day', phone: '+13105554421', status: 'ai_active', lastMessageAt: '2026-07-06T15:22:00Z', unreadCount: 1 },
    { id: '+16505557731', participantName: 'Ethan Hunt', phone: '+16505557731', status: 'ai_active', lastMessageAt: '2026-07-06T11:45:00Z', unreadCount: 0 },
    { id: '+17185550099', participantName: 'Grumpy Joe', phone: '+17185550099', status: 'human_handoff', lastMessageAt: '2026-07-06T18:10:00Z', unreadCount: 0 }
  ],
  messages: [
    { id: 'm1', conversationId: '+13105554421', direction: 'inbound', sender: 'lead', text: 'Hi, I need someone to look at a plumbing leak.', createdAt: '2026-07-06T15:20:00Z', status: 'received' },
    { id: 'm2', conversationId: '+13105554421', direction: 'outbound', sender: 'ai', text: 'Hi Charlie! I can help schedule a Plumbing Consultation. What day and time are you looking for?', createdAt: '2026-07-06T15:21:00Z', status: 'sent' },
    { id: 'm3', conversationId: '+13105554421', direction: 'inbound', sender: 'lead', text: 'Do you have anything on Tuesday morning July 7?', createdAt: '2026-07-06T15:22:00Z', status: 'received' },

    { id: 'm4', conversationId: '+16505557731', direction: 'inbound', sender: 'lead', text: 'I need HVAC maintenance.', createdAt: '2026-07-06T11:35:00Z', status: 'received' },
    { id: 'm5', conversationId: '+16505557731', direction: 'outbound', sender: 'ai', text: 'Hi Ethan, I can help schedule HVAC Maintenance. Standard duration is 60 mins. When would you like to schedule?', createdAt: '2026-07-06T11:36:00Z', status: 'sent' },
    { id: 'm6', conversationId: '+16505557731', direction: 'inbound', sender: 'lead', text: 'How about tomorrow Tuesday July 7 at 2 PM?', createdAt: '2026-07-06T11:37:00Z', status: 'received' },
    { id: 'm7', conversationId: '+16505557731', direction: 'outbound', sender: 'ai', text: 'Let me check... Yes, Tuesday July 7 at 2:00 PM is available. Can you confirm your on-site address or if you\'ll visit us?', createdAt: '2026-07-06T11:38:00Z', status: 'sent' },
    { id: 'm8', conversationId: '+16505557731', direction: 'inbound', sender: 'lead', text: 'On-site: 456 Elm St, Palo Alto. Confirm it please.', createdAt: '2026-07-06T11:40:00Z', status: 'received' },
    { id: 'm9', conversationId: '+16505557731', direction: 'outbound', sender: 'ai', text: 'Confirmed! Booked for Tuesday, July 7, 2026 at 2:00 PM (60 mins) at 456 Elm St, Palo Alto. You\'ll receive a reminder shortly before. Looking forward!', createdAt: '2026-07-06T11:45:00Z', status: 'sent' },

    { id: 'm10', conversationId: '+17185550099', direction: 'inbound', sender: 'lead', text: 'I want a refund. Your service sucks!', createdAt: '2026-07-06T18:05:00Z', status: 'received' },
    { id: 'm11', conversationId: '+17185550099', direction: 'outbound', sender: 'ai', text: 'I\'m sorry to hear that. Let me get a human supervisor to assist you with your refund immediately. A team member will text you shortly.', createdAt: '2026-07-06T18:10:00Z', status: 'sent' }
  ],
  calls: [
    { id: 'call1', phone: '+14085558812', direction: 'inbound', status: 'completed', durationSeconds: 45, transcription: 'Hello, looking for an electrical checkup. Hello? Can you hear me?', summary: 'Inbound call from Diana Prince asking about electrical diagnostics. Disconnected prematurely.', sentiment: 'neutral', createdAt: '2026-07-05T11:00:00Z' },
    { id: 'call2', phone: '+14155552671', direction: 'outbound', status: 'completed', durationSeconds: 120, transcription: 'Hi Alice, this is human support checking in on your recent booking. Yes, everything is perfect. Thank you!', summary: 'Outbound call to Alice Vance checking on booking feedback. Highly positive.', sentiment: 'positive', createdAt: '2026-07-04T16:00:00Z' }
  ],
  appointments: [
    { id: 'app1', leadId: 'l2', clientName: 'Ethan Hunt', clientPhone: '+16505557731', serviceType: 'HVAC Maintenance', startTime: '2026-07-07T14:00:00-07:00', endTime: '2026-07-07T15:00:00-07:00', status: 'confirmed', notes: 'On-site: 456 Elm St, Palo Alto', createdAt: '2026-07-06T11:45:00Z' }
  ],
  availability: defaultAvailability,
  agentActions: [
    { id: 'act1', timestamp: '2026-07-06T11:36:00Z', type: 'sms_received', description: 'Received HVAC Maintenance inquiry from Ethan Hunt' },
    { id: 'act2', timestamp: '2026-07-06T11:38:00Z', type: 'tool_execution', description: 'Checked availability for Tuesday July 7, slot found', payload: JSON.stringify({ slots: ['2026-07-07T14:00:00-07:00'] }) },
    { id: 'act3', timestamp: '2026-07-06T11:45:00Z', type: 'appointment_created', description: 'Created HVAC Maintenance appointment for Ethan Hunt', payload: JSON.stringify({ appointmentId: 'app1', startTime: '2026-07-07T14:00:00-07:00' }) },
    { id: 'act4', timestamp: '2026-07-06T18:10:00Z', type: 'handoff', description: 'Triggered human handoff for Grumpy Joe. Reason: Refund demand / Anger', payload: JSON.stringify({ reason: 'angry', phone: '+17185550099' }) }
  ],
  reminders: [
    { id: 'rem1', appointmentId: 'app1', type: 'sms', recipientPhone: '+16505557731', recipientName: 'Ethan Hunt', message: 'Hi Ethan, reminder of your HVAC Maintenance appointment tomorrow at 2:00 PM. Reply STOP to opt out.', sendAt: '2026-07-06T14:00:00-07:00', status: 'sent', createdAt: '2026-07-06T11:45:00Z' }
  ],
  handoffs: [
    { id: 'h1', phone: '+17185550099', leadName: 'Grumpy Joe', reason: 'angry', status: 'pending', notes: 'Demanding immediate refund. AI auto-escalated.', createdAt: '2026-07-06T18:10:00Z' }
  ],
  settings: defaultSettings
};

// Singleton DB instance
class Database {
  private data: DashboardData;

  constructor() {
    this.data = this.load();
  }

  private load(): DashboardData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        // Ensure all keys exist
        return {
          clients: parsed.clients || [],
          phoneNumbers: parsed.phoneNumbers || initialData.phoneNumbers,
          leads: parsed.leads || [],
          conversations: parsed.conversations || [],
          messages: parsed.messages || [],
          calls: parsed.calls || [],
          appointments: parsed.appointments || [],
          availability: parsed.availability || defaultAvailability,
          agentActions: parsed.agentActions || [],
          reminders: parsed.reminders || [],
          handoffs: parsed.handoffs || [],
          settings: { ...defaultSettings, ...(parsed.settings || {}) }
        };
      }
    } catch (e) {
      console.error('Error reading JSON db, resetting to initial', e);
    }
    this.save(initialData);
    return initialData;
  }

  private save(data: DashboardData) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write JSON db', e);
    }
  }

  getData(): DashboardData {
    return this.data;
  }

  saveData(newData: Partial<DashboardData>) {
    this.data = { ...this.data, ...newData } as DashboardData;
    this.save(this.data);
  }

  // Clients helper
  getClients() { return this.data.clients; }
  addClient(client: Omit<Client, 'id' | 'createdAt'>) {
    const newClient: Client = {
      ...client,
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    this.data.clients.push(newClient);
    this.save(this.data);
    return newClient;
  }

  // Leads helper
  getLeads() { return this.data.leads; }
  upsertLead(phone: string, update: Partial<Lead> & { name?: string, source?: string }) {
    let lead = this.data.leads.find(l => l.phone === phone);
    const now = new Date().toISOString();
    if (!lead) {
      lead = {
        id: 'l_' + Math.random().toString(36).substr(2, 9),
        phone,
        name: update.name || 'Unknown Lead',
        email: update.email,
        source: update.source || 'SMS',
        status: update.status || 'new',
        notes: update.notes || '',
        createdAt: now,
        updatedAt: now
      };
      this.data.leads.push(lead);
    } else {
      Object.assign(lead, {
        ...update,
        updatedAt: now
      });
    }
    this.save(this.data);
    return lead;
  }

  // Conversations & Messages helpers
  getConversations() { return this.data.conversations; }
  getMessages(conversationId: string) {
    return this.data.messages.filter(m => m.conversationId === conversationId);
  }
  
  addMessage(message: Omit<Message, 'id' | 'createdAt' | 'status'>) {
    const newMessage: Message = {
      ...message,
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      status: 'received'
    };
    this.data.messages.push(newMessage);

    // Update or create conversation
    let conversation = this.data.conversations.find(c => c.id === message.conversationId);
    if (!conversation) {
      // Find lead to set name
      const lead = this.data.leads.find(l => l.phone === message.conversationId);
      conversation = {
        id: message.conversationId,
        participantName: lead ? lead.name : 'Unknown Participant',
        phone: message.conversationId,
        status: 'ai_active',
        lastMessageAt: newMessage.createdAt,
        unreadCount: message.direction === 'inbound' ? 1 : 0
      };
      this.data.conversations.push(conversation);
    } else {
      conversation.lastMessageAt = newMessage.createdAt;
      if (message.direction === 'inbound') {
        conversation.unreadCount += 1;
      }
    }

    this.save(this.data);
    return newMessage;
  }

  // Calls helper
  getCalls() { return this.data.calls; }
  addCall(call: Omit<Call, 'id' | 'createdAt'>) {
    const newCall: Call = {
      ...call,
      id: 'call_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    this.data.calls.push(newCall);
    this.save(this.data);
    return newCall;
  }

  // Appointments helper
  getAppointments() { return this.data.appointments; }
  addAppointment(app: Omit<Appointment, 'id' | 'createdAt'>) {
    const newApp: Appointment = {
      ...app,
      id: 'app_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    this.data.appointments.push(newApp);

    // Auto-create lead state to appointment_booked
    this.upsertLead(app.clientPhone, {
      name: app.clientName,
      status: 'appointment_booked',
      notes: `Appointment confirmed for ${app.startTime}`
    });

    this.save(this.data);
    return newApp;
  }

  cancelAppointment(appointmentId: string) {
    const app = this.data.appointments.find(a => a.id === appointmentId);
    if (app) {
      app.status = 'cancelled';
      // Sync lead status back
      this.upsertLead(app.clientPhone, {
        status: 'contacted',
        notes: `Appointment cancelled by client.`
      });
      this.save(this.data);
    }
    return app;
  }

  // Availability helper
  getAvailability() { return this.data.availability; }
  setAvailability(slots: AvailabilitySlot[]) {
    this.data.availability = slots;
    this.save(this.data);
  }

  // Agent Actions helper
  getAgentActions() { return this.data.agentActions; }
  addAction(type: AgentAction['type'], description: string, payload?: any) {
    const newAction: AgentAction = {
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type,
      description,
      payload: payload ? JSON.stringify(payload) : undefined
    };
    this.data.agentActions.push(newAction);
    // Keep agent actions capped to 150 entries to prevent file size bloat
    if (this.data.agentActions.length > 150) {
      this.data.agentActions.shift();
    }
    this.save(this.data);
    return newAction;
  }

  // Reminders helper
  getReminders() { return this.data.reminders; }
  addReminder(rem: Omit<Reminder, 'id' | 'createdAt' | 'status'>) {
    const newReminder: Reminder = {
      ...rem,
      id: 'rem_' + Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.data.reminders.push(newReminder);
    this.save(this.data);
    return newReminder;
  }

  // Handoffs helper
  getHandoffs() { return this.data.handoffs; }
  addHandoff(handoff: Omit<Handoff, 'id' | 'createdAt' | 'status'>) {
    const newHandoff: Handoff = {
      ...handoff,
      id: 'h_' + Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.data.handoffs.push(newHandoff);

    // Update lead status to escalated
    this.upsertLead(handoff.phone, {
      name: handoff.leadName,
      status: 'escalated',
      notes: `Human handoff triggered: ${handoff.reason}`
    });

    // Update conversation status
    const conv = this.data.conversations.find(c => c.id === handoff.phone);
    if (conv) {
      conv.status = 'human_handoff';
    }

    this.save(this.data);
    return newHandoff;
  }

  resolveHandoff(handoffId: string, notes?: string) {
    const handoff = this.data.handoffs.find(h => h.id === handoffId);
    if (handoff) {
      handoff.status = 'resolved';
      if (notes) handoff.notes = notes;

      // Update conversation status back to AI active or resolved
      const conv = this.data.conversations.find(c => c.id === handoff.phone);
      if (conv) {
        conv.status = 'ai_active';
      }

      this.save(this.data);
    }
    return handoff;
  }

  // Settings helper
  getSettings() { return this.data.settings; }
  updateSettings(settings: Partial<SystemSettings>) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save(this.data);
    return this.data.settings;
  }
}

export const db = new Database();
