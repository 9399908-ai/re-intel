import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import ChatView from './views/ChatView';
import CalendarView from './views/CalendarView';
import AdminView from './views/AdminView';

function App() {
  const [currentView, setCurrentView] = useState('chat');
  const [selectedChannel, setSelectedChannel] = useState('TRD NYC Management');
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch channels on mount
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/channels');
        const data = await response.json();
        setChannels(data.channels);
      } catch (error) {
        console.error('Error fetching channels:', error);
        // Fallback to default channels
        setChannels([
          'TRD NYC Management',
          'TRD NJ Management',
          'TRD Boston Deals',
          'Multifamily Operators',
          'Cap Stack & Financing',
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

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
      <header className="bg-white shadow-subtle px-8 py-4 border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-bold text-3xl text-navy">Re-Intel.ai</h1>
          <p className="text-sm text-gray-600 mt-1">Professional community platform for real estate</p>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-100px)]">
        {/* Sidebar */}
        <Sidebar 
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          currentView={currentView}
          onSelectView={setCurrentView}
        />

        {/* Main Content Area */}
        <div className="flex-1 bg-white rounded-none md:rounded-lg md:m-5 overflow-hidden shadow-subtle">
          {currentView === 'chat' && (
            <ChatView selectedChannel={selectedChannel} />
          )}
          {currentView === 'calendar' && (
            <CalendarView />
          )}
          {currentView === 'admin' && (
            <AdminView />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
