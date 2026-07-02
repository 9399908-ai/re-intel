import React from 'react';

function Sidebar({ channels, selectedChannel, onSelectChannel, currentView, onSelectView }) {
  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-subtle md:m-5 md:rounded-lg">
      {/* User Profile Section */}
      <div className="bg-gradient-to-br from-navy to-blue text-white px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <span className="font-bold text-sm">SC</span>
          </div>
          <div>
            <p className="font-semibold text-sm">Sarah Chen</p>
            <p className="text-xs opacity-90">Owner • Multifamily</p>
          </div>
        </div>
        <div className="text-xs opacity-80 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          Online
        </div>
      </div>

      {/* View Switcher */}
      <div className="px-4 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelectView('chat')}
            className={`text-sm font-semibold px-3 py-2 rounded-lg transition-all ${
              currentView === 'chat'
                ? 'bg-blue text-white shadow-subtle'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => onSelectView('calendar')}
            className={`text-sm font-semibold px-3 py-2 rounded-lg transition-all ${
              currentView === 'calendar'
                ? 'bg-blue text-white shadow-subtle'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            📅 Calendar
          </button>
          <button
            onClick={() => onSelectView('admin')}
            className={`text-sm font-semibold px-3 py-2 rounded-lg transition-all ${
              currentView === 'admin'
                ? 'bg-blue text-white shadow-subtle'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⚙️ Admin
          </button>
        </div>
      </div>

      {/* Channels Section */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wide">Channels</h3>
      </div>

      {/* Channel List */}
      <nav className="flex-1 overflow-y-auto">
        {channels.map((channel) => (
          <button
            key={channel}
            onClick={() => onSelectChannel(channel)}
            className={`w-full text-left px-4 py-3 border-l-4 transition-all text-sm ${
              selectedChannel === channel
                ? 'bg-blue bg-opacity-5 text-blue border-l-blue font-semibold'
                : 'text-gray-700 border-l-transparent hover:bg-gray-50'
            }`}
          >
            {channel}
          </button>
        ))}
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
