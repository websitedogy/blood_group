import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { chatService } from '../../services/chatService';
import { ChatMessage, MutualContactInfo } from '../../types/chat';

interface ChatRoomScreenProps {
  roomId: string;
  currentUserId: string;
  recipientLabel?: string;
  onBack: () => void;
}

export default function ChatRoomScreen({
  roomId,
  currentUserId,
  recipientLabel,
  onBack,
}: ChatRoomScreenProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactInfo, setContactInfo] = useState<MutualContactInfo>({
    donor_phone: null,
    requester_phone: null,
    is_mutually_shared: false,
  });
  const [myConsent, setMyConsent] = useState(false);

  const loadChatData = useCallback(async () => {
    setLoading(true);
    const msgs = await chatService.getMessages(roomId);
    setMessages(msgs);
    const contact = await chatService.getMutualContactInfo(roomId);
    setContactInfo(contact);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    loadChatData();
  }, [loadChatData]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    const newMsg = await chatService.sendMessage(roomId, currentUserId, inputText);
    setSending(false);
    if (newMsg) {
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
    }
  };

  const handleToggleConsent = async () => {
    const nextVal = !myConsent;
    setMyConsent(nextVal);
    await chatService.setPhoneShareConsent(roomId, currentUserId, nextVal);
    const contact = await chatService.getMutualContactInfo(roomId);
    setContactInfo(contact);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {recipientLabel || 'Emergency Donor Chat'}
        </Text>
      </View>

      {/* Mutual Contact Share Banner */}
      <View style={styles.consentBanner}>
        <Text style={styles.consentNotice}>
          🔒 Phone Privacy: Numbers remain hidden unless both parties explicitly consent.
        </Text>
        {contactInfo.is_mutually_shared ? (
          <View style={styles.sharedContactBox}>
            <Text style={styles.sharedPhoneText}>
              ✓ Mutual Consent Active! Contact: {contactInfo.donor_phone || contactInfo.requester_phone}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.consentToggleBtn, myConsent && styles.consentToggleActive]}
            onPress={handleToggleConsent}
            accessibilityRole="button"
            accessibilityLabel="Toggle permission to share your phone number with this user"
          >
            <Text style={[styles.consentToggleText, myConsent && styles.consentToggleTextActive]}>
              {myConsent ? '✓ You approved phone sharing' : 'Approve sharing my phone number'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages Scroll Area */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#dc2626" />
        </View>
      ) : (
        <ScrollView style={styles.messagesList} contentContainerStyle={{ paddingVertical: 12 }}>
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>No messages yet. Send a message to coordinate donation.</Text>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === currentUserId;
              return (
                <View
                  key={m.id}
                  style={[styles.messageBubble, isMine ? styles.myBubble : styles.theirBubble]}
                >
                  <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>
                    {m.message_text}
                  </Text>
                  <Text style={[styles.timeText, isMine ? styles.myTime : styles.theirTime]}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Message Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type message here..."
          value={inputText}
          onChangeText={setInputText}
          editable={!sending}
          accessibilityLabel="Type your message"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    marginRight: 12,
  },
  backBtnText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 15,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  consentBanner: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  consentNotice: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 6,
  },
  consentToggleBtn: {
    borderWidth: 1,
    borderColor: '#d97706',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  consentToggleActive: {
    backgroundColor: '#d97706',
  },
  consentToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  consentToggleTextActive: {
    color: '#ffffff',
  },
  sharedContactBox: {
    backgroundColor: '#d1fae5',
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  sharedPhoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#dc2626',
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  myText: {
    color: '#ffffff',
  },
  theirText: {
    color: '#111827',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: '#fecaca',
  },
  theirTime: {
    color: '#9ca3af',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 30,
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  sendBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 20,
    paddingHorizontal: 18,
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
