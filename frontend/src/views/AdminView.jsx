import React, { useState } from 'react';

function AdminView() {
  const [pendingMembers] = useState([
    {
      id: 1,
      name: 'John Smith',
      email: 'john@example.com',
      title: 'Broker',
      company: 'Smith Realty',
      requestedAt: '2 hours ago',
    },
    {
      id: 2,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      title: 'Vendor',
      company: 'Property Solutions',
      requestedAt: '1 hour ago',
    },
  ]);

  const [events] = useState([
    {
      id: 1,
      title: 'Re-Deal NYC Mixer',
      date: '2024-06-30',
      time: '6:00 PM',
      capacity: 100,
      registered: 42,
    },
    {
      id: 2,
      title: 'Refinance Workshop',
      date: '2024-07-08',
      time: '2:00 PM',
      capacity: 50,
      registered: 28,
    },
  ]);

  const handleApprove = (id) => {
    alert(`Member ${id} approved!`);
  };

  const handleDeny = (id) => {
    alert(`Member ${id} denied`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-navy">Admin Panel</h2>
        <p className="text-xs text-gray-600">Manage members, events, and community</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Pending Verifications */}
        <section>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-navy uppercase tracking-wide">Pending Member Verification</h3>
            <p className="text-xs text-gray-600 mt-1">{pendingMembers.length} members awaiting approval</p>
          </div>
          <div className="space-y-3">
            {pendingMembers.map((member) => (
              <div key={member.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-navy">{member.name}</p>
                    <p className="text-xs text-gray-600">{member.email}</p>
                    <p className="text-xs text-gray-600">{member.title} • {member.company}</p>
                    <p className="text-xs text-gray-500 mt-2">Requested {member.requestedAt}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleApprove(member.id)}
                    className="flex-1 px-3 py-2 text-xs bg-green-500 text-white rounded hover:opacity-90 transition-opacity"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleDeny(member.id)}
                    className="flex-1 px-3 py-2 text-xs bg-red-500 text-white rounded hover:opacity-90 transition-opacity"
                  >
                    ✕ Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Events Management */}
        <section>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-navy uppercase tracking-wide">Upcoming Events</h3>
            <p className="text-xs text-gray-600 mt-1">{events.length} events scheduled</p>
          </div>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-navy">{event.title}</p>
                    <p className="text-xs text-gray-600">{event.date} at {event.time}</p>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue h-2 rounded-full"
                        style={{
                          width: `${(event.registered / event.capacity) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {event.registered} / {event.capacity} registered ({Math.round((event.registered / event.capacity) * 100)}%)
                    </p>
                  </div>
                </div>
                <button className="w-full px-3 py-2 text-xs bg-blue text-white rounded hover:opacity-90 transition-opacity">
                  Edit Event
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Stats */}
        <section>
          <h3 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">Quick Stats</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue bg-opacity-5 border border-blue rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue">42</p>
              <p className="text-xs text-gray-600 mt-1">Total Members</p>
            </div>
            <div className="bg-blue bg-opacity-5 border border-blue rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue">127</p>
              <p className="text-xs text-gray-600 mt-1">Messages</p>
            </div>
            <div className="bg-blue bg-opacity-5 border border-blue rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue">8</p>
              <p className="text-xs text-gray-600 mt-1">Matches</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminView;
