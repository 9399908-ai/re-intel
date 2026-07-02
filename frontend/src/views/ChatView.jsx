import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

function ChatView({ selectedChannel }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'Marcus Lee',
      content: 'Anyone using new property management software?',
      timestamp: '2:34 PM',
      isOwn: false,
    },
    {
      id: 2,
      sender: 'Jennifer Park',
      content: 'We switched to BuildingOS. Great reporting suite.',
      timestamp: '2:41 PM',
      isOwn: false,
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const { socket, isConnected } = useSocket();
  const messagesEndRef = useRef(null);

  // Join channel on mount or when it changes
  useEffect(() => {
    if (socket && selectedChannel) {
      socket.emit('join-channel', selectedChannel);
      // Clear messages when switching channels
      setMessages([]);
    }
  }, [socket, selectedChannel]);

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    socket.on('receive-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('user-joined', (data) => {
      console.log(data.message);
    });

    return () => {
      socket.off('receive-message');
      socket.off('user-joined');
    };
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() && socket) {
      // Send via Socket.io
      socket.emit('send-message', {
        channel: selectedChannel,
        message: inputValue,
        sender: 'You',
      });

      // Add to local state immediately (optimistic update)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'You',
          content: inputValue,
          timestamp: 'just now',
          isOwn: true,
        },
      ]);

      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-navy">{selectedChannel}</h2>
        <p className="text-xs text-gray-600">
          {isConnected ? '✅ Connected' : '⏳ Connecting...'}
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-white p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-500 text-sm">No messages yet in {selectedChannel}</p>
              <p className="text-gray-400 text-xs mt-2">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
            >
              {!msg.isOwn && (
                <div className="w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {msg.sender.charAt(0)}
                </div>
              )}
              <div className={msg.isOwn ? 'order-2' : ''}>
                <div
                  className={`rounded-2xl px-4 py-2 max-w-xs ${
                    msg.isOwn
                      ? 'bg-blue text-white'
                      : 'bg-gray-100 text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
                <p
                  className={`text-xs text-gray-600 mt-1 ${
                    msg.isOwn ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-6 py-4 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={!isConnected}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue focus:ring-opacity-50 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !inputValue.trim()}
          className="px-6 py-2 bg-blue text-white font-semibold rounded-lg hover:bg-darkblue transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatView;
