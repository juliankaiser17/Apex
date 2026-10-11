/// <reference types="vite/client" />

declare module 'virtual:ai-control-modal' {
  import React from 'react';
  export const AiControlCenterModal: React.FC<{ isOpen: boolean; onClose: () => void }>;
}

declare module '@fontsource/*';
