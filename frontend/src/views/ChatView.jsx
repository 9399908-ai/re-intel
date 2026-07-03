import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, avatarColor } from '../config';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉'];
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function dayLabel(iso) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function Avatar({ name, size = 8 }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}
      style={{ backgroundColor: avatarColor(name), width: size * 4, height: size * 4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ChatView({ socket, isConnected, selectedChannel, channelLabel, isDm, displayName, online }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState({}); // name -> true
  const messagesEndRef = useRef(null);
  const typingEmitRef = useRef({ active: false, timer: null });
  const typingClearTimers = useRef({});

  // Load message history when the channel changes
  useEffect(() => {
    if (!selectedChannel) return;
    let cancelled = false;
    setMessages([]);
    setReplyingTo(null);
    setTypingUsers({});

    fetch(`${API_URL}/api/messages?channel=${encodeURIComponent(selectedChannel)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setMessages(
          (data.messages || []).map((msg) => ({ ...msg, isOwn: msg.sender === displayName }))
        );
      })
      .catch((error) => console.error('Error loading message history:', error));

    return () => {
      cancelled = true;
    };
  }, [selectedChannel, displayName]);

  // Socket listeners for this channel
  useEffect(() => {
    if (!socket) return;

    const onReceive = (msg) => {
      if (msg.channel !== selectedChannel) return;
      setMessages((prev) => [...prev, { ...msg, isOwn: false }]);
      setTypingUsers((prev) => {
        if (!prev[msg.sender]) return prev;
        const next = { ...prev };
        delete next[msg.sender];
        return next;
      });
    };

    const onSaved = ({ channel, id, tempId }) => {
      if (channel !== selectedChannel || !tempId) return;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id } : m)));
    };

    const onDeleted = ({ channel, id }) => {
      if (channel !== selectedChannel) return;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    const onReaction = ({ channel, messageId, reactions }) => {
      if (channel !== selectedChannel) return;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    };

    const onTyping = ({ channel, sender, isTyping }) => {
      if (channel !== selectedChannel || sender === displayName) return;
      clearTimeout(typingClearTimers.current[sender]);
      if (isTyping) {
        setTypingUsers((prev) => ({ ...prev, [sender]: true }));
        typingClearTimers.current[sender] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[sender];
            return next;
          });
        }, 3000);
      } else {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[sender];
          return next;
        });
      }
    };

    socket.on('receive-message', onReceive);
    socket.on('message-saved', onSaved);
    socket.on('message-deleted', onDeleted);
    socket.on('message-reaction', onReaction);
    socket.on('typing', onTyping);
    return () => {
      socket.off('receive-message', onReceive);
      socket.off('message-saved', onSaved);
      socket.off('message-deleted', onDeleted);
      socket.off('message-reaction', onReaction);
      socket.off('typing', onTyping);
    };
  }, [socket, selectedChannel, displayName]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const emitTypingStop = useCallback(() => {
    if (typingEmitRef.current.active && socket) {
      socket.emit('typing', { channel: selectedChannel, sender: displayName, isTyping: false });
      typingEmitRef.current.active = false;
    }
    clearTimeout(typingEmitRef.current.timer);
  }, [socket, selectedChannel, displayName]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (!socket) return;
    if (!typingEmitRef.current.active) {
      socket.emit('typing', { channel: selectedChannel, sender: displayName, isTyping: true });
      typingEmitRef.current.active = true;
    }
    clearTimeout(typingEmitRef.current.timer);
    typingEmitRef.current.timer = setTimeout(emitTypingStop, 1500);
  };

  const handleSend = () => {
    if (!inputValue.trim() || !socket) return;

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const tempId = `t${Date.now()}`;
    const replySnapshot = replyingTo
      ? { id: replyingTo.id, sender: replyingTo.sender, content: replyingTo.content.slice(0, 120) }
      : null;

    socket.emit('send-message', {
      channel: selectedChannel,
      message: inputValue,
      sender: displayName,
      replyTo: replySnapshot,
      tempId,
    });

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender: displayName,
        content: inputValue,
        createdAt: new Date().toISOString(),
        replyTo: replySnapshot,
        reactions: {},
        isOwn: true,
      },
    ]);

    setInputValue('');
    setReplyingTo(null);
    emitTypingStop();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReact = (msg, emoji) => {
    if (!socket || typeof msg.id !== 'number') return; // wait for the real id
    socket.emit('react-message', {
      channel: selectedChannel,
      messageId: msg.id,
      emoji,
      reactor: displayName,
    });
  };

  const handleDelete = async (msg) => {
    if (typeof msg.id !== 'number') return;
    try {
      await fetch(
        `${API_URL}/api/messages/${msg.id}?channel=${encodeURIComponent(selectedChannel)}`,
        { method: 'DELETE' }
      );
      // removal happens via the message-deleted broadcast
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const typingNames = Object.keys(typingUsers);
  const otherOnline = isDm && online.includes(channelLabel);
  const statusLine =
    typingNames.length > 0
      ? `${typingNames.join(', ')} ${typingNames.length === 1 ? 'is' : 'are'} typing…`
      : isDm
      ? otherOnline
        ? 'online'
        : 'offline'
      : isConnected
      ? `${online.length} online`
      : 'Connecting…';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center gap-3">
        <Avatar name={channelLabel} />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-navy truncate">{channelLabel}</h2>
          <p className={`text-xs ${typingNames.length > 0 ? 'text-blue italic' : 'text-gray-600'}`}>
            {statusLine}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 md:px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-500 text-sm">No messages yet</p>
              <p className="text-gray-400 text-xs mt-2">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prev = messages[index - 1];
            const newDay =
              !prev || dayLabel(prev.createdAt) !== dayLabel(msg.createdAt);
            const grouped =
              !newDay &&
              prev &&
              prev.sender === msg.sender &&
              new Date(msg.createdAt) - new Date(prev.createdAt) < GROUP_WINDOW_MS;
            const reactionEntries = Object.entries(msg.reactions || {});

            return (
              <React.Fragment key={msg.id}>
                {newDay && (
                  <div className="flex justify-center my-4">
                    <span className="bg-white text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm border border-gray-200">
                      {dayLabel(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={`group flex gap-2 ${msg.isOwn ? 'justify-end' : 'justify-start'} ${
                    grouped ? 'mt-0.5' : 'mt-3'
                  }`}
                >
                  {!msg.isOwn && (
                    <div className="w-8 flex-shrink-0">
                      {!grouped && <Avatar name={msg.sender} />}
                    </div>
                  )}

                  <div className={`relative max-w-[75%] md:max-w-md ${msg.isOwn ? 'items-end' : ''}`}>
                    {/* Hover toolbar */}
                    <div
                      className={`absolute -top-7 ${
                        msg.isOwn ? 'right-0' : 'left-0'
                      } hidden group-hover:flex items-center gap-0.5 bg-white border border-gray-200 rounded-full shadow-sm px-1.5 py-0.5 z-10`}
                    >
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(msg, emoji)}
                          className="text-sm hover:scale-125 transition-transform px-0.5"
                          title={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="text-xs text-gray-500 hover:text-blue px-1"
                        title="Reply"
                      >
                        ↩
                      </button>
                      {msg.isOwn && (
                        <button
                          onClick={() => handleDelete(msg)}
                          className="text-xs text-gray-500 hover:text-red-500 px-1"
                          title="Delete for everyone"
                        >
                          🗑
                        </button>
                      )}
                    </div>

                    <div
                      className={`rounded-2xl px-3.5 py-2 shadow-sm ${
                        msg.isOwn
                          ? 'bg-blue text-white rounded-br-md'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                      }`}
                    >
                      {!msg.isOwn && !grouped && !isDm && (
                        <p
                          className="text-xs font-bold mb-0.5"
                          style={{ color: avatarColor(msg.sender) }}
                        >
                          {msg.sender}
                        </p>
                      )}
                      {msg.replyTo && (
                        <div
                          className={`text-xs rounded-lg px-2 py-1 mb-1 border-l-2 ${
                            msg.isOwn
                              ? 'bg-white bg-opacity-20 border-white border-opacity-60'
                              : 'bg-gray-100 border-blue'
                          }`}
                        >
                          <p className="font-semibold">{msg.replyTo.sender}</p>
                          <p className="truncate opacity-80">{msg.replyTo.content}</p>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={`text-[10px] mt-0.5 text-right ${
                          msg.isOwn ? 'text-white text-opacity-70' : 'text-gray-400'
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>

                    {/* Reaction chips */}
                    {reactionEntries.length > 0 && (
                      <div className={`flex gap-1 mt-1 ${msg.isOwn ? 'justify-end' : ''}`}>
                        {reactionEntries.map(([emoji, names]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg, emoji)}
                            title={names.join(', ')}
                            className={`text-xs rounded-full px-2 py-0.5 border shadow-sm ${
                              names.includes(displayName)
                                ? 'bg-blue bg-opacity-10 border-blue text-blue'
                                : 'bg-white border-gray-200 text-gray-600'
                            }`}
                          >
                            {emoji} {names.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyingTo && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-2 flex items-center gap-3">
          <div className="flex-1 border-l-2 border-blue pl-3 min-w-0">
            <p className="text-xs font-semibold text-blue">Replying to {replyingTo.sender}</p>
            <p className="text-xs text-gray-600 truncate">{replyingTo.content}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
            title="Cancel reply"
          >
            ×
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 md:px-6 py-3 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={`Message ${channelLabel}`}
          disabled={!isConnected}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue focus:ring-opacity-50 disabled:bg-gray-50 disabled:text-gray-400 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !inputValue.trim()}
          className="w-10 h-10 bg-blue text-white font-semibold rounded-full hover:bg-darkblue transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
          title="Send"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatView;
