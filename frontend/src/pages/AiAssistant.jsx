import React from 'react';
import PydahAiChat from '../components/PydahAiChat';

export default function AiAssistant() {
  return (
    <div className="h-[calc(100vh-4.25rem)] w-full flex flex-col overflow-hidden bg-background relative p-4">
      <PydahAiChat
        mode="embedded"
        title="CAMPO SD AI Assistant"
        welcomeMessage="Ask questions about your profile, attendance, and grades."
      />
    </div>
  );
}
