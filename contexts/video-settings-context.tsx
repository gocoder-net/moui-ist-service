import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VideoSettings {
  autoplay: boolean;
  muted: boolean;
  setAutoplay: (v: boolean) => void;
  setMuted: (v: boolean) => void;
}

const KEY_AUTOPLAY = 'moui-ist-video-autoplay';
const KEY_MUTED = 'moui-ist-video-muted';

const VideoSettingsContext = createContext<VideoSettings | null>(null);

export function VideoSettingsProvider({ children }: { children: ReactNode }) {
  const [autoplay, setAutoplayState] = useState(true);
  const [muted, setMutedState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(KEY_AUTOPLAY),
      AsyncStorage.getItem(KEY_MUTED),
    ]).then(([ap, mt]) => {
      if (ap !== null) setAutoplayState(ap === 'true');
      if (mt !== null) setMutedState(mt === 'true');
      setLoaded(true);
    });
  }, []);

  const setAutoplay = (v: boolean) => {
    setAutoplayState(v);
    AsyncStorage.setItem(KEY_AUTOPLAY, String(v));
  };
  const setMuted = (v: boolean) => {
    setMutedState(v);
    AsyncStorage.setItem(KEY_MUTED, String(v));
  };

  if (!loaded) return null;

  return (
    <VideoSettingsContext.Provider value={{ autoplay, muted, setAutoplay, setMuted }}>
      {children}
    </VideoSettingsContext.Provider>
  );
}

export function useVideoSettings() {
  const ctx = useContext(VideoSettingsContext);
  if (!ctx) throw new Error('useVideoSettings must be inside VideoSettingsProvider');
  return ctx;
}
