import React from 'react';
import { avatarColor, channelLabel } from '../config';

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function Sidebar({
  channels,
  selectedChannel,
  onSelectChannel,
  currentView,
  onSelectView,
  unread,
  online,
  displayName,
  onStartDm,
}) {
  const groups = channels.filter((c) => c.type !== 'dm');
  const dms = channels.filter((c) => c.type === 'dm');
  const onlineOthers = online.filter((name) => name !== displayName);

  return (
    <aside className="w-72 h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-subtle md:m-5 md:rounded-lg">
      {/* User Profile Section */}
      <div className="bg-gradient-to-br from-navy to-blue text-white px-6 py-5">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: avatarColor(displayName) }}
          >
            <span className="font-bold text-sm">{displayName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{displayName}</p>
            <p className="text-xs opacity-90">Member</p>
          </div>
        </div>
        <div className="text-xs opacity-80 flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          {online.length} online
        </div>
      </div>

      {/* View Switcher */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-1">
          {[
            { id: 'chat', label: '💬 Chat' },
            { id: 'calendar', label: '📅 Events' },
            { id: 'admin', label: '⚙️ Admin' },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => onSelectView(view.id)}
              className={`flex-1 text-xs font-semibold px-2 py-2 rounded-lg transition-all ${
                currentView === view.id
                  ? 'bg-blue text-white shadow-subtle'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {/* Channels */}
        <div className="px-4 py-3">
          <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wide">Channels</h3>
        </div>
        {groups.map((channel) => {
          const isSelected = selectedChannel === channel.name && currentView === 'chat';
          const count = unread[channel.name] || 0;
          return (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel.name)}
              className={`w-full text-left px-4 py-2.5 border-l-4 transition-all text-sm flex items-center gap-2 ${
                isSelected
                  ? 'bg-blue bg-opacity-5 text-blue border-l-blue font-semibold'
                  : count > 0
                  ? 'text-gray-900 font-semibold border-l-transparent hover:bg-gray-50'
                  : 'text-gray-700 border-l-transparent hover:bg-gray-50'
              }`}
            >
              <span className="truncate">{channel.name}</span>
              <UnreadBadge count={isSelected ? 0 : count} />
            </button>
          );
        })}

        {/* Direct Messages */}
        {dms.length > 0 && (
          <>
            <div className="px-4 py-3 mt-2">
              <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wide">Direct Messages</h3>
            </div>
            {dms.map((channel) => {
              const label = channelLabel(channel, displayName);
              const isSelected = selectedChannel === channel.name && currentView === 'chat';
              const count = unread[channel.name] || 0;
              const isOnline = online.includes(label);
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.name)}
                  className={`w-full text-left px-4 py-2.5 border-l-4 transition-all text-sm flex items-center gap-2 ${
                    isSelected
                      ? 'bg-blue bg-opacity-5 text-blue border-l-blue font-semibold'
                      : 'text-gray-700 border-l-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="relative flex-shrink-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: avatarColor(label) }}
                    >
                      {label.charAt(0).toUpperCase()}
                    </span>
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </span>
                  <span className="truncate">{label}</span>
                  <UnreadBadge count={isSelected ? 0 : count} />
                </button>
              );
            })}
          </>
        )}

        {/* Online members — click to start a DM */}
        {onlineOthers.length > 0 && (
          <>
            <div className="px-4 py-3 mt-2">
              <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wide">
                Online now
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Click a member to message them</p>
            </div>
            {onlineOthers.map((name) => (
              <button
                key={name}
                onClick={() => onStartDm(name)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="relative flex-shrink-0">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: avatarColor(name) }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                </span>
                <span className="truncate">{name}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-600 text-center">
        <p>Re-Intel.ai</p>
        <p className="text-gray-500">Professional Community</p>
      </div>
    </aside>
  );
}

export default Sidebar;
