import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { processIncomingSMS, processIncomingCall } from './server/agent.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes - Always FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get full dashboard data
  app.get('/api/db', (req, res) => {
    res.json(db.getData());
  });

  // 1. REAL TWILIO SMS WEBHOOK (compliant, returns XML TwiML)
  app.post('/api/twilio/sms', async (req, res) => {
    const { From, To, Body, MessageSid } = req.body;
    
    if (!From || !Body) {
      res.status(400).send('Missing From or Body parameter.');
      return;
    }

    try {
      const replyText = await processIncomingSMS(From, Body);
      
      // Return standard Twilio TwiML XML
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${replyText}</Message>
</Response>`);
    } catch (err) {
      console.error('Error handling Twilio SMS Webhook:', err);
      res.status(500).send('Error processing SMS webhook.');
    }
  });

  // 2. REAL TWILIO VOICE WEBHOOK
  app.post('/api/twilio/voice', async (req, res) => {
    const { From, SpeechResult, RecordingUrl } = req.body;
    
    if (!From) {
      res.status(400).send('Missing From parameter.');
      return;
    }

    try {
      const callResult = await processIncomingCall(From, SpeechResult);

      res.type('text/xml');
      
      if (callResult.action === 'transcribe_and_route') {
        // Human escalation: say sorry and dial a support forwarding number
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${callResult.responseText}</Say>
    <Enqueue>human_support_queue</Enqueue>
</Response>`);
      } else {
        // Speak AI response and gather speech for next turn
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" action="/api/twilio/voice">
        <Say voice="alice">${callResult.responseText}</Say>
    </Gather>
    <Say voice="alice">We did not hear a response. Thank you for calling Apex Services. Goodbye.</Say>
</Response>`);
      }
    } catch (err) {
      console.error('Error handling Twilio Voice Webhook:', err);
      res.status(500).send('Error processing Voice webhook.');
    }
  });

  // 3. TWILIO SIMULATOR ENDPOINTS (Frontend interaction)
  app.post('/api/simulator/sms', async (req, res) => {
    const { phone, text } = req.body;
    if (!phone || !text) {
      res.status(400).json({ error: 'Missing phone or text parameter.' });
      return;
    }

    try {
      const reply = await processIncomingSMS(phone, text);
      res.json({ success: true, reply });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/simulator/call', async (req, res) => {
    const { phone, speechText } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'Missing phone parameter.' });
      return;
    }

    try {
      const result = await processIncomingCall(phone, speechText);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. MANUAL HUMAN OVERRIDE REPLY (allows human agent to reply to any conversation)
  app.post('/api/manual/reply', (req, res) => {
    const { conversationId, text } = req.body;
    if (!conversationId || !text) {
      res.status(400).json({ error: 'Missing conversationId or text.' });
      return;
    }

    const message = db.addMessage({
      conversationId,
      direction: 'outbound',
      sender: 'human',
      text
    });

    // Mark conversation as read
    const conv = db.getConversations().find(c => c.id === conversationId);
    if (conv) {
      conv.unreadCount = 0;
    }

    db.addAction('sms_sent', `Manual human operator replied to ${conversationId}: "${text.substring(0, 40)}"`);
    db.saveData({}); // trigger save

    res.json({ success: true, message });
  });

  // Resolve active Handoff
  app.post('/api/handoffs/resolve', (req, res) => {
    const { id, notes } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Missing handoff ID.' });
      return;
    }

    const handoff = db.resolveHandoff(id, notes);
    if (handoff) {
      db.addAction('tool_execution', `Human operator resolved handoff for ${handoff.phone}. Notes: ${notes || 'none'}`);
      res.json({ success: true, handoff });
    } else {
      res.status(404).json({ error: 'Handoff not found.' });
    }
  });

  // CRUD for Appointments
  app.post('/api/appointments', (req, res) => {
    const { clientName, clientPhone, serviceType, startTime, notes } = req.body;
    if (!clientName || !clientPhone || !serviceType || !startTime) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }

    const startObj = new Date(startTime);
    const endObj = new Date(startObj.getTime() + 60 * 60 * 1000);

    const appObj = db.addAppointment({
      clientName,
      clientPhone,
      serviceType,
      startTime,
      endTime: endObj.toISOString(),
      status: 'confirmed',
      notes
    });

    db.addAction('appointment_created', `Human booked appointment for ${clientName}: ${startTime}`);
    res.json({ success: true, appointment: appObj });
  });

  app.post('/api/appointments/cancel', (req, res) => {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Missing appointment ID.' });
      return;
    }

    const appObj = db.cancelAppointment(id);
    if (appObj) {
      db.addAction('tool_execution', `Appointment ${id} cancelled by human operator.`);
      res.json({ success: true, appointment: appObj });
    } else {
      res.status(404).json({ error: 'Appointment not found.' });
    }
  });

  // CRUD for Clients
  app.post('/api/clients', (req, res) => {
    const { name, phone, email, notes } = req.body;
    if (!name || !phone) {
      res.status(400).json({ error: 'Name and Phone are required.' });
      return;
    }

    const client = db.addClient({ name, phone, email, notes });
    res.json({ success: true, client });
  });

  // Update Settings
  app.post('/api/settings', (req, res) => {
    const settings = db.updateSettings(req.body);
    db.addAction('tool_execution', `System configuration settings updated.`);
    res.json({ success: true, settings });
  });

  // Background Job: Scheduler & Reminders processor
  setInterval(() => {
    const now = new Date();
    const reminders = db.getReminders();
    let updated = false;

    reminders.forEach(rem => {
      if (rem.status === 'pending' && new Date(rem.sendAt) <= now) {
        rem.status = 'sent';
        updated = true;

        // Log action
        db.addAction('sms_sent', `Automated Reminder dispatched to ${rem.recipientName} (${rem.recipientPhone}): "${rem.message.substring(0, 40)}"`);
        
        // Add outbound message to log
        db.addMessage({
          conversationId: rem.recipientPhone,
          direction: 'outbound',
          sender: 'ai',
          text: `[REMINDER] ${rem.message}`
        });
      }
    });

    if (updated) {
      db.saveData({ reminders });
    }
  }, 10000); // Check every 10 seconds

  // Handle Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
