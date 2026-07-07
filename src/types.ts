export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface PhoneNumber {
  id: string;
  number: string;
  type: 'tracking' | 'forwarded';
  assignedToId?: string; // Client or Provider ID
  assignedToName?: string;
  status: 'active' | 'inactive';
  label: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string; // e.g., "SMS", "Voice Call", "Web"
  status: 'new' | 'contacted' | 'appointment_booked' | 'nurturing' | 'lost' | 'escalated';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string; // usually lead/client phone number
  participantName: string;
  phone: string;
  status: 'ai_active' | 'human_handoff' | 'resolved';
  lastMessageAt: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  sender: 'lead' | 'ai' | 'human';
  text: string;
  createdAt: string;
  status: 'sent' | 'delivered' | 'failed' | 'received';
}

export interface Call {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'completed' | 'failed' | 'missed' | 'routed_to_human';
  durationSeconds: number;
  recordingUrl?: string;
  transcription?: string;
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'angry';
  createdAt: string;
}

export interface Appointment {
  id: string;
  leadId?: string;
  clientName: string;
  clientPhone: string;
  serviceType: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed';
  notes?: string;
  createdAt: string;
}

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "17:00"
  isBooked?: boolean;
}

export interface AgentAction {
  id: string;
  timestamp: string;
  type: 'sms_received' | 'sms_sent' | 'call_received' | 'tool_execution' | 'handoff' | 'appointment_created';
  description: string;
  payload?: string; // JSON string
}

export interface Reminder {
  id: string;
  appointmentId: string;
  type: 'sms' | 'email';
  recipientPhone: string;
  recipientName: string;
  message: string;
  sendAt: string; // ISO string
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
}

export interface Handoff {
  id: string;
  phone: string;
  leadName: string;
  reason: 'confused' | 'risky' | 'angry' | 'payment_related' | 'manual';
  status: 'pending' | 'resolved';
  notes?: string;
  createdAt: string;
}

export interface SystemSettings {
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  openaiApiKey?: string;
  systemPrompt: string;
  blockedWords: string[];
  optOutStrings: string[];
  allowAIReplies: boolean;
  appointmentDurationMinutes: number;
  availableServices: string[];
}

export interface DashboardData {
  clients: Client[];
  phoneNumbers: PhoneNumber[];
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  calls: Call[];
  appointments: Appointment[];
  availability: AvailabilitySlot[];
  agentActions: AgentAction[];
  reminders: Reminder[];
  handoffs: Handoff[];
  settings: SystemSettings;
}
