let activeDisconnect: (() => void) | null = null;

export const setRealtimeDisconnect = (handler: (() => void) | null): void => {
  activeDisconnect = handler;
};

export const disconnectRealtime = (): void => {
  if (activeDisconnect) {
    activeDisconnect();
  }
};
