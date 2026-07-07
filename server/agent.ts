import { GoogleGenAI, Type } from '@google/genai';
import { db } from './db.js';

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || '';

let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log('Gemini AI Client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini AI Client with provided key:', err);
  }
} else {
  console.log('No GEMINI_API_KEY found in process.env. Running in Demo Simulation Mode.');
}

// Function Declarations for Gemini Tool Calling
const checkAvailabilityTool = {
  name: 'checkAvailability',
  description: 'Checks the available scheduling slots and existing booked appointments on the calendar. Use this to see what slots are currently free.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  }
};

const createAppointmentTool = {
  name: 'createAppointment',
  description: 'Books and confirms a new appointment for the user. Call this when the day, time, service type, and name are all decided and confirmed.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      clientName: {
        type: Type.STRING,
        description: 'The first and last name of the client scheduling the appointment.'
      },
      clientPhone: {
        type: Type.STRING,
        description: 'The contact phone number of the client.'
      },
      serviceType: {
        type: Type.STRING,
        description: 'The type of service requested. Must be one of: "Plumbing Consultation", "HVAC Maintenance", "Electrical Diagnostic".'
      },
      startTime: {
        type: Type.STRING,
        description: 'The ISO 8601 combined date and time string representing the appointment start time (e.g. "2026-07-07T14:00:00-07:00").'
      }
    },
    required: ['clientName', 'clientPhone', 'serviceType', 'startTime']
  }
};

const escalateToHumanTool = {
  name: 'escalateToHuman',
  description: 'Escalates the chat to a human operator. Call this immediately if the client is angry, complains about a refund, asks complex questions outside scheduling, or requests custom pricing negotiations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'The reason for human handoff (e.g., "angry", "confused", "payment_related", "risky").'
      }
    },
    required: ['reason']
  }
};

// Tool Execution Handlers
function executeCheckAvailability() {
  const appointments = db.getAppointments();
  const availability = db.getAvailability();
  
  // Return slot details mapped with booking status
  const list = availability.map(slot => {
    // Generate ISO times for this week (Tuesday July 7, 2026 is DayOfWeek 2)
    // Let's offset based on the current date of Tuesday, July 7, 2026
    const baseDate = new Date('2026-07-07T00:00:00-07:00');
    const dayOffset = slot.dayOfWeek - 2; // 2 is Tuesday
    const targetDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    
    const dateStr = targetDate.toISOString().split('T')[0];
    const startTimeISO = `${dateStr}T${slot.startTime}:00-07:00`;
    const endTimeISO = `${dateStr}T${slot.endTime}:00-07:00`;
    
    // Check if there is an overlapping confirmed appointment
    const isBooked = appointments.some(app => 
      app.clientPhone && 
      app.status !== 'cancelled' && 
      app.startTime === startTimeISO
    );
    
    return {
      id: slot.id,
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayOfWeek],
      date: dateStr,
      startTime: startTimeISO,
      endTime: endTimeISO,
      isAvailable: !isBooked,
      label: `${slot.startTime} to ${slot.endTime}`
    };
  });

  return { availableSlots: list.filter(l => l.isAvailable), bookedSlots: list.filter(l => !l.isAvailable) };
}

function executeCreateAppointment(args: { clientName: string; clientPhone: string; serviceType: string; startTime: string }) {
  const { clientName, clientPhone, serviceType, startTime } = args;
  
  // Calculate end time (default duration is 60 minutes)
  const startObj = new Date(startTime);
  const endObj = new Date(startObj.getTime() + 60 * 60 * 1000); // +1 hour
  const endTime = endObj.toISOString();

  const appointment = db.addAppointment({
    clientName,
    clientPhone,
    serviceType,
    startTime,
    endTime,
    status: 'confirmed',
    notes: 'Booked automatically by AI agent.'
  });

  // Schedule auto reminder for 1 hour before appointment
  const sendAtObj = new Date(startObj.getTime() - 60 * 60 * 1000);
  db.addReminder({
    appointmentId: appointment.id,
    type: 'sms',
    recipientPhone: clientPhone,
    recipientName: clientName,
    message: `Hi ${clientName}, this is a reminder for your ${serviceType} tomorrow at ${startObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Reply STOP to opt out.`,
    sendAt: sendAtObj.toISOString()
  });

  return { success: true, appointment };
}

function executeEscalateToHuman(phone: string, name: string, args: { reason: string }) {
  const handoff = db.addHandoff({
    phone,
    leadName: name,
    reason: args.reason as any,
    notes: 'AI Agent triggered auto escalation.'
  });
  return { success: true, handoff };
}

// Check for blocked words in incoming messages
function containsBlockedWords(text: string, blockedList: string[]): boolean {
  const lower = text.toLowerCase();
  return blockedList.some(word => lower.includes(word.toLowerCase()));
}

// Check if message is opt-out
function isOptOut(text: string, optOutList: string[]): boolean {
  const lower = text.trim().toLowerCase();
  return optOutList.some(word => lower === word.toLowerCase() || lower.startsWith(word.toLowerCase() + ' '));
}

// Process Incoming SMS through AI logic
export async function processIncomingSMS(phone: string, text: string): Promise<string> {
  const settings = db.getSettings();
  
  // Log message in database
  db.upsertLead(phone, { source: 'SMS' });
  db.addMessage({
    conversationId: phone,
    direction: 'inbound',
    sender: 'lead',
    text
  });
  
  db.addAction('sms_received', `Received SMS from ${phone}: "${text.substring(0, 40)}"`);

  // 1. Compliance: Opt-Out Check
  if (isOptOut(text, settings.optOutStrings)) {
    db.addAction('handoff', `Opt-out detected for ${phone}. Stop requested.`, { text });
    db.upsertLead(phone, { status: 'lost', notes: 'Opted out of SMS communications' });
    const reply = "You have been opted out of further notifications. Reply START to rejoin.";
    
    db.addMessage({
      conversationId: phone,
      direction: 'outbound',
      sender: 'ai',
      text: reply
    });
    return reply;
  }

  // 2. Compliance: Blocked Words Check
  if (containsBlockedWords(text, settings.blockedWords)) {
    db.addAction('handoff', `Spam/Blocked word detected from ${phone}. Triggering immediate escalation.`, { text });
    const lead = db.getLeads().find(l => l.phone === phone) || { name: 'Unknown Participant' };
    db.addHandoff({
      phone,
      leadName: lead.name,
      reason: 'risky',
      notes: `Anti-spam triggered. Customer texted: "${text}"`
    });

    const reply = "Thank you for reaching out. We have transferred your inquiry to a customer care representative who will review your message shortly.";
    db.addMessage({
      conversationId: phone,
      direction: 'outbound',
      sender: 'ai',
      text: reply
    });
    return reply;
  }

  // 3. Handoff check (if conversation is currently flagged as handoff, notify human but don't auto-reply)
  const conv = db.getConversations().find(c => c.id === phone);
  if (conv && conv.status === 'human_handoff') {
    db.addAction('tool_execution', `Escalated conversation is active. Suppressing AI reply for ${phone}.`);
    // Simply return empty or a message noting human is looking at it
    return "A supervisor has been alerted and will reply to you directly very soon.";
  }

  // Check if AI replies are globally disabled
  if (!settings.allowAIReplies) {
    db.addAction('tool_execution', `AI replies are globally disabled. Adding to handoff queue.`);
    const lead = db.getLeads().find(l => l.phone === phone) || { name: 'Unknown Participant' };
    db.addHandoff({
      phone,
      leadName: lead.name,
      reason: 'manual',
      notes: 'AI replies disabled. Waiting for human response.'
    });
    return "Thank you. We are routing your inquiry to our dispatcher.";
  }

  // Determine current lead name
  const currentLead = db.getLeads().find(l => l.phone === phone);
  const leadName = currentLead ? currentLead.name : 'Unknown Participant';

  // 4. Run through Gemini Agent
  if (aiClient) {
    try {
      // Build conversation history
      const allMsgs = db.getMessages(phone);
      // Format messages into Gemini API content payload
      // Select the last 15 messages to stay within prompt limits and keep it focused
      const recentMsgs = allMsgs.slice(-15);
      
      const contentsPayload: any[] = recentMsgs.map(m => {
        return {
          role: m.direction === 'inbound' ? 'user' : 'model',
          parts: [{ text: m.text }]
        };
      });

      // Append standard info context
      const systemInstruction = `${settings.systemPrompt}
      
CURRENT CONTEXT:
- Today's date: Tuesday, July 7, 2026.
- Customer phone: ${phone}
- Customer name: ${leadName}
- Standard service duration: ${settings.appointmentDurationMinutes} minutes.
- Available services: ${settings.availableServices.join(', ')}

Available Slots info:
When checking slots, note that we have Monday to Friday availability. Remember that Tuesday, July 7, 2026 is Today.

Always call checkAvailability first if they ask about times.`;

      // API Call with function declarations
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contentsPayload,
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [
              checkAvailabilityTool,
              createAppointmentTool,
              escalateToHumanTool
            ]
          }],
          toolConfig: { includeServerSideToolInvocations: true }
        }
      });

      let finalReply = response.text || '';
      
      // Process any function calls
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        db.addAction('tool_execution', `AI requested tool calls: ${functionCalls.map(f => f.name).join(', ')}`);
        
        const toolContents = [...contentsPayload];
        
        // Add the model's function calls to the payload history
        toolContents.push(response.candidates?.[0]?.content);

        // Execute function calls and accumulate results
        const functionResponseParts: any[] = [];
        
        for (const call of functionCalls) {
          let result: any = {};
          
          if (call.name === 'checkAvailability') {
            result = executeCheckAvailability();
            db.addAction('tool_execution', `Executed tool checkAvailability. Found ${result.availableSlots.length} open slots.`);
          } else if (call.name === 'createAppointment') {
            const args = call.args as any;
            result = executeCreateAppointment(args);
            db.addAction('appointment_created', `AI booked appointment for ${args.clientName}: ${args.startTime}`);
            // Update lead name in database if they provided a new name
            if (args.clientName && args.clientName !== 'Unknown Participant') {
              db.upsertLead(phone, { name: args.clientName });
            }
          } else if (call.name === 'escalateToHuman') {
            const args = call.args as any;
            result = executeEscalateToHuman(phone, leadName, args);
            db.addAction('handoff', `AI triggered escalation. Reason: ${args.reason}`);
          }

          functionResponseParts.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }

        // Add the tool execution replies to the conversation history
        toolContents.push({
          role: 'user',
          parts: functionResponseParts
        });

        // Run Gemini again to formulate the text response with the tool output context
        const secondResponse = await aiClient.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: toolContents,
          config: {
            systemInstruction,
            tools: [{
              functionDeclarations: [
                checkAvailabilityTool,
                createAppointmentTool,
                escalateToHumanTool
              ]
            }],
            toolConfig: { includeServerSideToolInvocations: true }
          }
        });

        finalReply = secondResponse.text || 'I have updated our records with your appointment. Let me know if you need anything else!';
      }

      if (finalReply) {
        // Save outgoing AI message
        db.addMessage({
          conversationId: phone,
          direction: 'outbound',
          sender: 'ai',
          text: finalReply
        });
        
        db.addAction('sms_sent', `AI sent SMS to ${phone}: "${finalReply.substring(0, 40)}"`);
        return finalReply;
      }
    } catch (apiError) {
      console.error('Gemini API call failed, falling back to Rules Engine', apiError);
    }
  }

  // 5. Rules-based Fallback Engine (Demo Mode / Offline Fallback)
  // Highly intelligent regex parsing of booking requests
  let reply = '';
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
    reply = `Hi there! I can help you schedule a Plumbing Consultation, HVAC Maintenance, or Electrical Diagnostic at Apex Services. What are you looking for today?`;
  } else if (lowerText.includes('plumb') || lowerText.includes('leak') || lowerText.includes('drain')) {
    const slots = executeCheckAvailability().availableSlots;
    const dateText = slots.length > 0 ? `Tuesday July 7 at ${new Date(slots[0].startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Wednesday at 9:00 AM";
    reply = `I can book a Plumbing Consultation for you. We have an opening on ${dateText}. Does that work? (Simulation Fallback Mode)`;
  } else if (lowerText.includes('hvac') || lowerText.includes('heater') || lowerText.includes('ac ') || lowerText.includes('air')) {
    reply = `Sure, I can book an HVAC Maintenance. Our standard rule is 60 minutes consultation. Would you prefer Tuesday July 7 at 2:00 PM or 3:00 PM? (Simulation Fallback Mode)`;
  } else if (lowerText.includes('yes') || lowerText.includes('confirm') || lowerText.includes('works') || lowerText.includes('book')) {
    // Attempt automatic booking in simulation mode
    const finalName = leadName === 'Unknown Participant' ? 'Demo Customer' : leadName;
    const targetSlot = '2026-07-07T10:00:00-07:00';
    executeCreateAppointment({
      clientName: finalName,
      clientPhone: phone,
      serviceType: 'Plumbing Consultation',
      startTime: targetSlot
    });
    reply = `Confirmed! Booked for Tuesday, July 7, 2026 at 10:00 AM (60 minutes). You'll receive a text reminder shortly. Thank you!`;
  } else if (lowerText.includes('refund') || lowerText.includes('supervisor') || lowerText.includes('angry') || lowerText.includes('suck') || lowerText.includes('bad')) {
    executeEscalateToHuman(phone, leadName, { reason: 'angry' });
    reply = `I apologize for the frustration. I have escalated this conversation to a human support agent who will follow up with you directly.`;
  } else {
    reply = `I understand. Let me check our availability... Yes, we have openings this week for Plumbing, HVAC, and Electrical services. Please let me know what date and time works best for you!`;
  }

  // Save the fallback outbound message
  db.addMessage({
    conversationId: phone,
    direction: 'outbound',
    sender: 'ai',
    text: reply
  });
  
  db.addAction('sms_sent', `AI sent SMS (Fallback) to ${phone}: "${reply.substring(0, 40)}"`);
  return reply;
}

// Process Incoming Voice Call through AI / Routing
export async function processIncomingCall(phone: string, inputAudioText?: string): Promise<{ action: 'transcribe_and_route' | 'ai_reply'; responseText: string; recordingUrl?: string }> {
  db.upsertLead(phone, { source: 'Voice Call' });
  
  const text = inputAudioText || '';
  db.addAction('call_received', `Inbound voice call from ${phone}. Transcription: "${text.substring(0, 40)}"`);

  const settings = db.getSettings();
  const currentLead = db.getLeads().find(l => l.phone === phone);
  const leadName = currentLead ? currentLead.name : 'Unknown Participant';

  // Simulate call transcribing and summaries
  let responseText = "Thank you for calling Apex Services Dispatch. Connecting you to a live scheduler now.";
  let summary = "Inbound call. Connected immediately to a live representative.";
  let sentiment: 'positive' | 'neutral' | 'negative' | 'angry' = 'neutral';

  if (text) {
    if (text.toLowerCase().includes('plumb') || text.toLowerCase().includes('leak') || text.toLowerCase().includes('appointment')) {
      responseText = "Checking calendar. Yes, I can book an appointment for Tuesday morning at 10:00 AM. One moment while I transfer you to secure confirmation.";
      summary = `Customer requested scheduling. Transcribed text: "${text}". Checked slots. Route to supervisor.`;
      sentiment = 'positive';
    } else if (text.toLowerCase().includes('angry') || text.toLowerCase().includes('mad') || text.toLowerCase().includes('sucks') || text.toLowerCase().includes('refund')) {
      responseText = "We apologize for the issue. Transferring your call to our support supervisor right away.";
      summary = `Customer is upset. Audio sentiment: angry. Immediate handoff.`;
      sentiment = 'angry';
      db.addHandoff({
        phone,
        leadName,
        reason: 'angry',
        notes: `Voice Call Escalation: "${text}"`
      });
    } else {
      summary = `General inquiry call. Conversation details: "${text}"`;
    }
  }

  db.addCall({
    phone,
    direction: 'inbound',
    status: 'completed',
    durationSeconds: 35,
    transcription: text || 'No speech detected.',
    summary,
    sentiment
  });

  return {
    action: sentiment === 'angry' ? 'transcribe_and_route' : 'ai_reply',
    responseText,
    recordingUrl: 'https://api.twilio.com/mock/recordings/rec_928342'
  };
}
