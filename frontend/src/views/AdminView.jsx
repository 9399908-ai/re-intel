import React, { useState, useEffect, useCallback } from 'react';
import { authFetch as api } from '../api';
import { avatarColor } from '../config';

const formatEventDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const formatEventTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-navy uppercase tracking-wide">{title}</h3>
      {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
    </div>
  );
}

function AdminView({ user, online }) {
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ members: 0, messages: 0, matches: 0 });
  const [matchSuggestions, setMatchSuggestions] = useState([]);
  const [introduced, setIntroduced] = useState({}); // "u1-u2" -> true
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Forms
  const [newChannel, setNewChannel] = useState({ name: '', description: '' });
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [editingChannelName, setEditingChannelName] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', startDate: '', location: '', capacity: '' });
  const [editingEventId, setEditingEventId] = useState(null);
  const [editingEvent, setEditingEvent] = useState({});

  const loadData = useCallback(async () => {
    try {
      const [channelsRes, directoryRes, membersRes, eventsRes, statsRes, matchesRes] =
        await Promise.all([
          api('/api/channels'),
          api('/api/members'),
          api('/api/members/pending'),
          api('/api/events'),
          api('/api/stats'),
          api('/api/matches/suggestions'),
        ]);
      setChannels((channelsRes.channels || []).filter((c) => c.type !== 'dm'));
      setMembers(directoryRes.members || []);
      setPendingMembers(membersRes.members || []);
      setEvents(eventsRes.events || []);
      setStats(statsRes.stats || { members: 0, messages: 0, matches: 0 });
      setMatchSuggestions(matchesRes.suggestions || []);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const run = async (fn, failMessage) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      console.error(failMessage, err);
      setError(failMessage);
    }
  };

  // Channel actions
  const createChannel = () =>
    run(async () => {
      if (!newChannel.name.trim()) return;
      const { channel } = await api('/api/channels', {
        method: 'POST',
        body: JSON.stringify(newChannel),
      });
      setChannels((prev) => [...prev, channel]);
      setNewChannel({ name: '', description: '' });
    }, 'Could not create channel.');

  const renameChannel = (id) =>
    run(async () => {
      if (!editingChannelName.trim()) return;
      const { channel } = await api(`/api/channels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingChannelName }),
      });
      setChannels((prev) => prev.map((c) => (c.id === id ? channel : c)));
      setEditingChannelId(null);
    }, 'Could not rename channel.');

  const deleteChannel = (id) =>
    run(async () => {
      await api(`/api/channels/${id}`, { method: 'DELETE' });
      setChannels((prev) => prev.filter((c) => c.id !== id));
    }, 'Could not delete channel.');

  // Member actions
  const memberAction = (id, action) =>
    run(async () => {
      const result = await api(`/api/members/${id}/${action}`, { method: 'POST' });
      setPendingMembers((prev) => prev.filter((m) => m.id !== id));
      if (action === 'approve' && result.member) {
        setMembers((prev) =>
          [...prev, result.member].sort((a, b) => a.name.localeCompare(b.name))
        );
        setStats((prev) => ({ ...prev, members: prev.members + 1 }));
      }
    }, `Could not ${action} member.`);

  const setAdmin = (id, makeAdmin) =>
    run(async () => {
      const { member } = await api(`/api/members/${id}/${makeAdmin ? 'promote' : 'demote'}`, {
        method: 'POST',
      });
      setMembers((prev) => prev.map((m) => (m.id === id ? member : m)));
    }, `Could not ${makeAdmin ? 'promote' : 'demote'} member.`);

  const removeMember = (id) =>
    run(async () => {
      await api(`/api/members/${id}/remove`, { method: 'POST' });
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setStats((prev) => ({ ...prev, members: Math.max(0, prev.members - 1) }));
      setConfirmRemoveId(null);
    }, 'Could not remove member.');

  // Match actions
  const introduce = (match) =>
    run(async () => {
      await api('/api/matches/introduce', {
        method: 'POST',
        body: JSON.stringify({ user1Id: match.userId, user2Id: match.matchedUserId }),
      });
      setIntroduced((prev) => ({ ...prev, [`${match.userId}-${match.matchedUserId}`]: true }));
      setStats((prev) => ({ ...prev, matches: prev.matches + 1 }));
    }, 'Could not create introduction.');

  // Event actions
  const createEvent = () =>
    run(async () => {
      if (!newEvent.title.trim() || !newEvent.startDate) return;
      const { event } = await api('/api/events', {
        method: 'POST',
        body: JSON.stringify(newEvent),
      });
      setEvents((prev) =>
        [...prev, event].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      );
      setNewEvent({ title: '', startDate: '', location: '', capacity: '' });
    }, 'Could not create event.');

  const saveEvent = (id) =>
    run(async () => {
      const { event } = await api(`/api/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editingEvent),
      });
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...event } : e)));
      setEditingEventId(null);
    }, 'Could not update event.');

  const deleteEvent = (id) =>
    run(async () => {
      await api(`/api/events/${id}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }, 'Could not delete event.');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500">Loading admin data...</p>
      </div>
    );
  }

  const inputCls =
    'px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue focus:ring-opacity-50';

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-navy">Admin Panel</h2>
        <p className="text-xs text-gray-600">Manage channels, members, events, and matches</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Channel Management */}
        <section>
          <SectionHeader title="Channels" subtitle={`${channels.length} communities`} />
          <div className="space-y-2 mb-3">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2"
              >
                {editingChannelId === channel.id ? (
                  <>
                    <input
                      value={editingChannelName}
                      onChange={(e) => setEditingChannelName(e.target.value)}
                      className={`${inputCls} flex-1`}
                      autoFocus
                    />
                    <button
                      onClick={() => renameChannel(channel.id)}
                      className="px-3 py-1.5 text-xs bg-blue text-white rounded hover:opacity-90"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingChannelId(null)}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-navy truncate">{channel.name}</p>
                      {channel.description && (
                        <p className="text-xs text-gray-600 truncate">{channel.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingChannelId(channel.id);
                        setEditingChannelName(channel.name);
                      }}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => deleteChannel(channel.id)}
                      className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row gap-2">
            <input
              placeholder="New channel name"
              value={newChannel.name}
              onChange={(e) => setNewChannel((c) => ({ ...c, name: e.target.value }))}
              className={`${inputCls} flex-1`}
            />
            <input
              placeholder="Description (optional)"
              value={newChannel.description}
              onChange={(e) => setNewChannel((c) => ({ ...c, description: e.target.value }))}
              className={`${inputCls} flex-1`}
            />
            <button
              onClick={createChannel}
              disabled={!newChannel.name.trim()}
              className="px-4 py-2 text-xs bg-blue text-white rounded-lg hover:opacity-90 disabled:bg-gray-300"
            >
              + Create Channel
            </button>
          </div>
        </section>

        {/* Pending Verifications */}
        <section>
          <SectionHeader
            title="Pending Member Verification"
            subtitle={`${pendingMembers.length} members awaiting approval`}
          />
          {pendingMembers.length === 0 ? (
            <p className="text-sm text-gray-500">No members awaiting approval</p>
          ) : (
            <div className="space-y-3">
              {pendingMembers.map((member) => (
                <div key={member.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="mb-3">
                    <p className="font-semibold text-sm text-navy">{member.name}</p>
                    <p className="text-xs text-gray-600">{member.email}</p>
                    <p className="text-xs text-gray-600">{member.title} • {member.company}</p>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => memberAction(member.id, 'approve')}
                      className="flex-1 px-3 py-2 text-xs bg-green-500 text-white rounded hover:opacity-90"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => memberAction(member.id, 'deny')}
                      className="flex-1 px-3 py-2 text-xs bg-red-500 text-white rounded hover:opacity-90"
                    >
                      ✕ Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Member Directory */}
        <section>
          <SectionHeader
            title="Member Directory"
            subtitle={`${members.length} approved members — promote admins or remove members`}
          />
          <input
            placeholder="Search by name, company, email, role, or market…"
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            className={`${inputCls} w-full mb-3`}
          />
          <div className="space-y-2">
            {members
              .filter((m) => {
                const q = memberQuery.trim().toLowerCase();
                if (!q) return true;
                return [m.name, m.company, m.email, m.title, m.role, ...(m.markets || [])]
                  .filter(Boolean)
                  .some((field) => field.toLowerCase().includes(q));
              })
              .map((member) => {
                const isSelf = member.id === user.id;
                const isOnline = online.includes(member.name);
                return (
                  <div
                    key={member.id}
                    className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3"
                  >
                    <span className="relative flex-shrink-0">
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: avatarColor(member.name) }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-navy truncate">
                        {member.name}
                        {isSelf && <span className="text-gray-400 font-normal"> (you)</span>}
                        {member.isAdmin && (
                          <span className="ml-2 text-[10px] bg-navy text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {[member.title, member.company].filter(Boolean).join(' • ')} — {member.email}
                      </p>
                      {(member.markets?.length > 0 || member.assetTypes?.length > 0) && (
                        <p className="text-xs text-gray-500 truncate">
                          {[...(member.markets || []), ...(member.assetTypes || [])].join(', ')}
                        </p>
                      )}
                    </div>
                    {!isSelf && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {confirmRemoveId === member.id ? (
                          <>
                            <button
                              onClick={() => removeMember(member.id)}
                              className="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:opacity-90"
                            >
                              Confirm remove
                            </button>
                            <button
                              onClick={() => setConfirmRemoveId(null)}
                              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setAdmin(member.id, !member.isAdmin)}
                              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                            >
                              {member.isAdmin ? 'Revoke admin' : 'Make admin'}
                            </button>
                            <button
                              onClick={() => setConfirmRemoveId(member.id)}
                              className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        {/* Match Suggestions */}
        <section>
          <SectionHeader
            title="Weekly Match Suggestions"
            subtitle="Introduce members to open a DM between them with a concierge intro"
          />
          {matchSuggestions.length === 0 ? (
            <p className="text-sm text-gray-500">Not enough verified members to generate matches</p>
          ) : (
            <div className="space-y-2">
              {matchSuggestions.map((match, index) => {
                const key = `${match.userId}-${match.matchedUserId}`;
                return (
                  <div
                    key={`${key}-${index}`}
                    className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3"
                  >
                    <p className="text-xs text-gray-700 flex-1 min-w-0">
                      <span className="font-semibold text-navy">{match.userName}</span>
                      {' ↔ '}
                      <span className="font-semibold text-navy">{match.matchedName}</span>
                      <span className="text-gray-500"> ({match.matchedTitle}, {match.matchedCompany})</span>
                    </p>
                    <span className="text-xs font-bold text-blue flex-shrink-0">{match.score}</span>
                    {introduced[key] ? (
                      <span className="text-xs text-green-600 font-semibold flex-shrink-0">Introduced ✓</span>
                    ) : (
                      <button
                        onClick={() => introduce(match)}
                        className="px-3 py-1.5 text-xs bg-blue text-white rounded hover:opacity-90 flex-shrink-0"
                      >
                        Introduce
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Events Management */}
        <section>
          <SectionHeader title="Events" subtitle={`${events.length} events scheduled`} />
          <div className="space-y-3 mb-3">
            {events.map((event) => {
              const registered = event.registered ?? 0;
              const capacity = event.capacity || 0;
              const pct = capacity ? Math.round((registered / capacity) * 100) : 0;
              const isEditing = editingEventId === event.id;
              return (
                <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editingEvent.title}
                        onChange={(e) => setEditingEvent((ev) => ({ ...ev, title: e.target.value }))}
                        className={`${inputCls} w-full`}
                        placeholder="Title"
                      />
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          type="datetime-local"
                          value={editingEvent.startDate}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev, startDate: e.target.value }))}
                          className={`${inputCls} flex-1`}
                        />
                        <input
                          value={editingEvent.location || ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev, location: e.target.value }))}
                          className={`${inputCls} flex-1`}
                          placeholder="Location"
                        />
                        <input
                          type="number"
                          value={editingEvent.capacity || ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev, capacity: e.target.value }))}
                          className={`${inputCls} w-24`}
                          placeholder="Capacity"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEvent(event.id)}
                          className="px-4 py-1.5 text-xs bg-blue text-white rounded hover:opacity-90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingEventId(null)}
                          className="px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-navy">{event.title}</p>
                          <p className="text-xs text-gray-600">
                            {formatEventDate(event.startDate)} at {formatEventTime(event.startDate)}
                            {event.location ? ` • ${event.location}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingEventId(event.id);
                            setEditingEvent({
                              title: event.title,
                              startDate: new Date(event.startDate).toISOString().slice(0, 16),
                              location: event.location || '',
                              capacity: event.capacity || '',
                            });
                          }}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                      {capacity > 0 && (
                        <>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue h-2 rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {registered} / {capacity} registered ({pct}%)
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <input
              placeholder="New event title"
              value={newEvent.title}
              onChange={(e) => setNewEvent((ev) => ({ ...ev, title: e.target.value }))}
              className={`${inputCls} w-full`}
            />
            <div className="flex flex-col md:flex-row gap-2">
              <input
                type="datetime-local"
                value={newEvent.startDate}
                onChange={(e) => setNewEvent((ev) => ({ ...ev, startDate: e.target.value }))}
                className={`${inputCls} flex-1`}
              />
              <input
                placeholder="Location"
                value={newEvent.location}
                onChange={(e) => setNewEvent((ev) => ({ ...ev, location: e.target.value }))}
                className={`${inputCls} flex-1`}
              />
              <input
                type="number"
                placeholder="Capacity"
                value={newEvent.capacity}
                onChange={(e) => setNewEvent((ev) => ({ ...ev, capacity: e.target.value }))}
                className={`${inputCls} w-full md:w-24`}
              />
              <button
                onClick={createEvent}
                disabled={!newEvent.title.trim() || !newEvent.startDate}
                className="px-4 py-2 text-xs bg-blue text-white rounded-lg hover:opacity-90 disabled:bg-gray-300"
              >
                + Create Event
              </button>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section>
          <SectionHeader title="Quick Stats" />
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: stats.members, label: 'Verified Members' },
              { value: stats.messages, label: 'Messages' },
              { value: stats.matches, label: 'Matches' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-blue bg-opacity-5 border border-blue rounded-lg p-4 text-center"
              >
                <p className="text-2xl font-bold text-blue">{stat.value}</p>
                <p className="text-xs text-gray-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminView;
