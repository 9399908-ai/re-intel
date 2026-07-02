import React from 'react';

function CalendarView() {
  const events = [
    {
      id: 1,
      title: 'Re-Deal NYC Mixer',
      date: 'Sun, Jun 30',
      time: '6:00 PM',
      location: 'Marriott, Midtown',
      status: 'attending',
    },
    {
      id: 2,
      title: 'Refinance Workshop',
      date: 'Mon, Jul 8',
      time: '2:00 PM',
      location: 'Virtual',
      status: 'registered',
    },
    {
      id: 3,
      title: 'TRD NYC Management Monthly Standup',
      date: 'Wed, Jul 10',
      time: '10:00 AM',
      location: 'Zoom',
      status: 'scheduled',
    },
  ];

  const meetings = [
    {
      id: 1,
      name: 'Robert Martinez',
      date: 'Sun, Jun 30',
      time: '3:00 PM',
      type: 'Google Meet',
      status: 'approved',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-navy">Your Events & Calendar</h2>
        <p className="text-xs text-gray-600">Upcoming events and meetings</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Meetings Section */}
        {meetings.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-navy mb-4 uppercase tracking-wide">Your Meetings</h3>
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="border-l-4 border-blue bg-blue bg-opacity-5 rounded-lg p-4"
                >
                  <p className="font-semibold text-sm text-navy">{meeting.name}</p>
                  <p className="text-xs text-gray-600 mt-2">📅 {meeting.date} • {meeting.time}</p>
                  <p className="text-xs text-gray-600">{meeting.type} • Status: {meeting.status}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Events Section */}
        <section>
          <h3 className="text-sm font-bold text-navy mb-4 uppercase tracking-wide">Upcoming Events</h3>
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-subtle transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-navy">{event.title}</h4>
                    <p className="text-xs text-gray-600 mt-2">📅 {event.date} • {event.time}</p>
                    <p className="text-xs text-gray-600">📍 {event.location}</p>
                    <p className="text-xs text-gray-500 mt-2">Status: {event.status}</p>
                  </div>
                  <button className="px-3 py-1 text-xs bg-blue text-white rounded hover:opacity-90 transition-opacity">
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CalendarView;
