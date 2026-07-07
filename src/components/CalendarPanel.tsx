import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { Appointment, AvailabilitySlot } from '../types.js';

interface CalendarPanelProps {
  appointments: Appointment[];
  availability: AvailabilitySlot[];
  onCancelAppointment: (id: string) => void;
  onCreateAppointment: (clientName: string, clientPhone: string, serviceType: string, startTime: string, notes?: string) => void;
}

export const CalendarPanel: React.FC<CalendarPanelProps> = ({
  appointments,
  availability,
  onCancelAppointment,
  onCreateAppointment
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('Plumbing Consultation');
  const [date, setDate] = useState('2026-07-07');
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const activeAppointments = appointments.filter(a => a.status !== 'cancelled');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !service || !date || !time) return;

    // Build ISO timestamp
    const startTimeISO = `${date}T${time}:00-07:00`;
    onCreateAppointment(name, phone, service, startTimeISO, notes);
    
    // Reset form
    setName('');
    setPhone('');
    setNotes('');
    setShowAddModal(false);
  };

  // Maps day name
  const getDayName = (dayNum: number) => {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum];
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl" id="calendar-panel-container">
      <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-amber-500" />
          <h2 className="font-sans font-bold text-slate-100 text-lg tracking-tight">Dispatch Schedule Board</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
          id="btn-open-booking-modal"
        >
          <Plus className="w-3.5 h-3.5" /> Book Appointment
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Confirmed Appointments list */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Booked Appointments (Today & Upcoming)</h3>
          
          {activeAppointments.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm">No scheduled appointments found.</p>
              <p className="text-xs text-slate-600 mt-1">Use the simulator or booking form to schedule an appointment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAppointments.map(app => {
                const startDate = new Date(app.startTime);
                const timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateString = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                
                return (
                  <div key={app.id} className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl flex items-start justify-between gap-4" id={`app-card-${app.id}`}>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          app.serviceType.includes('Plumbing') ? 'bg-blue-500' :
                          app.serviceType.includes('HVAC') ? 'bg-orange-500' : 'bg-yellow-500'
                        }`}></span>
                        <span className="font-sans font-bold text-slate-200 text-sm">{app.clientName}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] uppercase font-bold tracking-wider">
                          {app.status}
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-400 font-mono space-y-0.5">
                        <p className="text-slate-300 font-sans font-semibold text-amber-400">{app.serviceType}</p>
                        <p>{dateString} @ {timeString}</p>
                        <p className="text-slate-500">Phone: {app.clientPhone}</p>
                        {app.notes && <p className="text-slate-400 italic font-sans mt-1">Notes: "{app.notes}"</p>}
                      </div>
                    </div>

                    <button
                      onClick={() => onCancelAppointment(app.id)}
                      className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Cancel Appointment"
                      id={`btn-cancel-app-${app.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weekly Slots Grid representation */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Weekly Dispatch Slots</h3>
          <div className="p-4 bg-slate-950 border border-slate-800/60 rounded-xl space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-sans">Standard Hours: Mon - Fri</span>
              <span className="font-mono text-amber-500">9:00 AM - 5:00 PM</span>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {/* Filter availability to show slots */}
              {[1, 2, 3, 4, 5].map(day => {
                const daySlots = availability.filter(s => s.dayOfWeek === day);
                // Check how many of these are currently booked on Tuesday, July 7
                const baseDate = '2026-07-07'; // Let's use Tuesday as baseline
                return (
                  <div key={day} className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-0.5 border-b border-slate-800/60">
                      {getDayName(day)}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 py-1">
                      {daySlots.map(slot => {
                        // Check if booked for this slot's time
                        const targetDate = new Date('2026-07-07T00:00:00-07:00');
                        const dayOffset = day - 2;
                        const actualDateObj = new Date(targetDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
                        const dateStr = actualDateObj.toISOString().split('T')[0];
                        const startISO = `${dateStr}T${slot.startTime}:00-07:00`;
                        
                        const isBooked = appointments.some(a => a.startTime === startISO && a.status !== 'cancelled');
                        
                        return (
                          <div
                            key={slot.id}
                            className={`px-1.5 py-1.5 rounded text-[10px] font-mono text-center border transition-all ${
                              isBooked
                                ? 'bg-slate-900 border-slate-800/80 text-slate-600 line-through'
                                : 'bg-slate-900/40 border-slate-800 text-amber-400/80'
                            }`}
                            title={isBooked ? 'Booked' : 'Available'}
                          >
                            {slot.startTime}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Booking Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" id="booking-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-sans font-bold text-slate-100">Manual Appointment Booking</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Client Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="John Doe"
                  id="modal-name-input"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Client Phone</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500"
                  placeholder="+13105554421"
                  id="modal-phone-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Service Type</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    id="modal-service-select"
                  >
                    <option value="Plumbing Consultation">Plumbing</option>
                    <option value="HVAC Maintenance">HVAC</option>
                    <option value="Electrical Diagnostic">Electrical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Time</label>
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500"
                    id="modal-time-select"
                  >
                    <option value="09:00">09:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono focus:outline-none focus:border-amber-500"
                  id="modal-date-input"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="On-site requirements, parking rules, etc."
                  id="modal-notes-input"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-all cursor-pointer"
                  id="modal-close-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all cursor-pointer"
                  id="modal-submit-btn"
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
