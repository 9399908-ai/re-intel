import React, { useState, useEffect } from 'react';
import { authFetch } from '../api';

const formatEventDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const formatEventTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const registrationsKey = (email) => `reintel_registrations_${email}`;

const loadRegistrations = (email) => {
  try {
    return JSON.parse(localStorage.getItem(registrationsKey(email)) || '[]');
  } catch {
    return [];
  }
};

function CalendarView({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState(() => loadRegistrations(user.email));
  const [error, setError] = useState(null);

  useEffect(() => {
    authFetch('/api/events')
      .then((data) => setEvents(data.events || []))
      .catch((err) => console.error('Error fetching events:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleRegister = async (event) => {
    setError(null);
    try {
      await authFetch(`/api/events/${event.id}/register`, { method: 'POST' });
      const next = [...new Set([...registrations, event.id])];
      setRegistrations(next);
      localStorage.setItem(registrationsKey(user.email), JSON.stringify(next));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id && !registrations.includes(event.id)
            ? { ...e, registered: (e.registered ?? 0) + 1 }
            : e
        )
      );
    } catch (err) {
      console.error('Error registering:', err);
      setError('Could not register. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-navy">Events</h2>
        <p className="text-xs text-gray-600">Upcoming community events</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <section>
          <h3 className="text-sm font-bold text-navy mb-4 uppercase tracking-wide">Upcoming Events</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const isRegistered = registrations.includes(event.id);
                const isFull =
                  event.capacity && (event.registered ?? 0) >= event.capacity && !isRegistered;
                return (
                  <div
                    key={event.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-subtle transition-shadow"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-navy">{event.title}</h4>
                        {event.description && (
                          <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-2">
                          📅 {formatEventDate(event.startDate)} • {formatEventTime(event.startDate)}
                        </p>
                        {event.location && (
                          <p className="text-xs text-gray-600">📍 {event.location}</p>
                        )}
                        {event.capacity && (
                          <p className="text-xs text-gray-500 mt-2">
                            {event.registered ?? 0} / {event.capacity} registered
                          </p>
                        )}
                      </div>
                      {isRegistered ? (
                        <span className="px-3 py-1.5 text-xs text-green-600 font-semibold flex-shrink-0">
                          Registered ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRegister(event)}
                          disabled={isFull}
                          className="px-4 py-1.5 text-xs bg-blue text-white rounded hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {isFull ? 'Full' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default CalendarView;
