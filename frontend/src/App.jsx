import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import ChatView from './views/ChatView';
import CalendarView from './views/CalendarView';
import AdminView from './views/AdminView';
import { API_URL, getDisplayName, channelLabel } from './config';
import { useSocket } from './hooks/useSocket';

function App() {
  const [currentView, setCurrentView] = useState('chat');
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null); // channel name
  const [unread, setUnread] = useState({}); // channel name -> count
  const [online, setOnline] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayName] = useState(getDisplayName);
  const { socket, isConnected } = useSocket();

  const selectedRef = useRef(selectedChannel);
  selectedRef.current = selectedChannel;

  const fetchChannels = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/channels?member=${encodeURIComponent(displayName)}`
      );
      const data = await response.json();
      const list = data.channels || [];
      setChannels(list);
      setSelectedChannel((current) => {
        if (current && list.some((c) => c.name === current)) return current;
        const firstGroup = list.find((c) => c.type !== 'dm');
        return firstGroup ? firstGroup.name : null;
      });
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  }, [displayName]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Identify + join all channel rooms (re-runs on reconnect)
  useEffect(() => {
    if (!socket) return;
    const register = () => {
      socket.emit('identify', displayName);
      if (channels.length > 0) {
        socket.emit('join-channels', channels.map((c) => c.name));
      }
    };
    if (socket.connected) register();
    socket.on('connect', register);
    return () => socket.off('connect', register);
  }, [socket, channels, displayName]);

  // Global listeners: unread counts, notifications, presence, live channel list
  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg) => {
      if (msg.channel !== selectedRef.current) {
        setUnread((prev) => ({ ...prev, [msg.channel]: (prev[msg.channel] || 0) + 1 }));
      }
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        (document.hidden || msg.channel !== selectedRef.current)
      ) {
        new Notification(`${msg.sender}`, { body: msg.content, tag: `reintel-${msg.channel}` });
      }
    };
    const onPresence = (data) => setOnline(data.online || []);
    const onChannelsUpdated = () => fetchChannels();
    const onDmStarted = () => fetchChannels();

    socket.on('receive-message', onMessage);
    socket.on('presence', onPresence);
    socket.on('channels-updated', onChannelsUpdated);
    socket.on('dm-started', onDmStarted);
    return () => {
      socket.off('receive-message', onMessage);
      socket.off('presence', onPresence);
      socket.off('channels-updated', onChannelsUpdated);
      socket.off('dm-started', onDmStarted);
    };
  }, [socket, fetchChannels]);

  const handleSelectChannel = (name) => {
    setSelectedChannel(name);
    setCurrentView('chat');
    setUnread((prev) => ({ ...prev, [name]: 0 }));
    setSidebarOpen(false);
  };

  const handleStartDm = async (otherName) => {
    try {
      const response = await fetch(`${API_URL}/api/dms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: [displayName, otherName] }),
      });
      const data = await response.json();
      if (data.channel) {
        await fetchChannels();
        handleSelectChannel(data.channel.name);
      }
    } catch (error) {
      console.error('Error starting DM:', error);
    }
  };

  const selected = channels.find((c) => c.name === selectedChannel);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy to-blue flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="font-semibold">Loading Re-Intel.ai...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-subtle px-4 md:px-8 py-4 border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="md:hidden p-2 -ml-2 text-navy"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-2xl md:text-3xl text-navy">Re-Intel.ai</h1>
            <p className="hidden md:block text-sm text-gray-600 mt-1">
              Professional community platform for real estate
            </p>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-73px)] md:h-[calc(100vh-100px)] relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-40 z-20"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar — drawer on mobile, fixed on desktop */}
        <div
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 transition-transform fixed md:static inset-y-0 left-0 z-30 md:z-auto`}
        >
          <Sidebar
            channels={channels}
            selectedChannel={selectedChannel}
            onSelectChannel={handleSelectChannel}
            currentView={currentView}
            onSelectView={(view) => {
              setCurrentView(view);
              setSidebarOpen(false);
            }}
            unread={unread}
            online={online}
            displayName={displayName}
            onStartDm={handleStartDm}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white rounded-none md:rounded-lg md:m-5 overflow-hidden shadow-subtle">
          {currentView === 'chat' && selected && (
            <ChatView
              socket={socket}
              isConnected={isConnected}
              selectedChannel={selectedChannel}
              channelLabel={channelLabel(selected, displayName)}
              isDm={selected.type === 'dm'}
              displayName={displayName}
              online={online}
            />
          )}
          {currentView === 'chat' && !selected && (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              No channels yet — ask an admin to create one.
            </div>
          )}
          {currentView === 'calendar' && <CalendarView />}
          {currentView === 'admin' && <AdminView />}
        </div>
      </div>
    </div>
  );
}

export default App;
