import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

const formatEventDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const formatEventTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function CalendarView() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/events`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch((error) => console.error('Error fetching events:', error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-navy">Your Events & Calendar</h2>
        <p className="text-xs text-gray-600">Upcoming events and meetings</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <h3 className="text-sm font-bold text-navy mb-4 uppercase tracking-wide">Upcoming Events</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-subtle transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-navy">{event.title}</h4>
                      {event.description && (
                        <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-2">
                        📅 {formatEventDate(event.startDate)} • {formatEventTime(event.startDate)}
                      </p>
                      {event.location && <p className="text-xs text-gray-600">📍 {event.location}</p>}
                      {event.capacity && (
                        <p className="text-xs text-gray-500 mt-2">
                          {event.registered ?? 0} / {event.capacity} registered
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default CalendarView;
