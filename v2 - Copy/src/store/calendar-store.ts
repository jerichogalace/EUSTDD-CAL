import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EventStatus = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';
export type EventCategory = 'schedule' | 'cto' | 'wfh' | 'travel';
export type ProjectRequestStatus = 'pending' | 'approved' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';

export type AnimationType = 'static' | 'scroll-up' | 'scroll-down' | 'fade' | 'slide-left' | 'slide-right' | 'flip' | 'bounce' | 'continuous-scroll-up' | 'continuous-scroll-down';
export type ThemeMode = 'dark' | 'light' | 'auto';

export interface ProjectRequest {
  id: string;
  name: string;
  number: string; // Changed to string for flexibility
  status: ProjectRequestStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date | null; // For CTO/FL, WFH, Travel entries - end date for expiration
  time: string;
  timeEnd?: string | null;
  location?: string | null;
  description?: string | null;
  status: EventStatus;
  category: EventCategory;
  createdAt: Date;
  updatedAt: Date;
}

export interface PanelAnimation {
  type: AnimationType;
  enabled: boolean;
  interval: number; // seconds between transitions (e.g., 5, 10, 15)
}

export interface ThemeSettings {
  mode: ThemeMode;
  brightness: number; // 50-150 percentage
  contrast: number; // 50-150 percentage
  saturation: number; // 50-150 percentage
  blueLightFilter: number; // 0-100 percentage
  fontSize: 'small' | 'normal' | 'large' | 'extra-large';
  reduceMotion: boolean;
  // Custom colors (RGB)
  backgroundColor: string; // Hex color for background
  cardBackgroundColor: string; // Hex color for card backgrounds
  primaryTextColor: string; // Hex color for primary text
  secondaryTextColor: string; // Hex color for secondary text
  accentColor: string; // Hex color for accents/highlights
}

export interface Settings {
  // Animation settings for main schedule panels
  todayAnimation: PanelAnimation;
  tomorrowAnimation: PanelAnimation;
  // Animation settings for category panels - separate for each
  todayCTOAnimation: PanelAnimation;
  todayWFHAnimation: PanelAnimation;
  todayTravelAnimation: PanelAnimation;
  tomorrowCategoryAnimation: PanelAnimation; // For project request panel
  colors: {
    upcoming: string;
    ongoing: string;
    finished: string;
    cancelled: string;
  };
  // Theme settings
  theme: ThemeSettings;
}

interface CalendarState {
  events: CalendarEvent[];
  settings: Settings;
  isAdmin: boolean;
  isLoading: boolean;
  isPinProtected: boolean;

  // Actions
  setEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  setSettings: (settings: Partial<Settings>) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsPinProtected: (isPinProtected: boolean) => void;
}

const defaultColors = {
  upcoming: '#3b82f6', // Blue
  ongoing: '#22c55e', // Green
  finished: '#9ca3af', // Light Gray
  cancelled: '#4b5563', // Dark Gray
};

const defaultPanelAnimation: PanelAnimation = {
  type: 'static',
  enabled: false,
  interval: 5, // 5 seconds default
};

const defaultThemeSettings: ThemeSettings = {
  mode: 'dark',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blueLightFilter: 0,
  fontSize: 'normal',
  reduceMotion: false,
  // Default colors (dark theme)
  backgroundColor: '#030712', // gray-950
  cardBackgroundColor: '#111827', // gray-900
  primaryTextColor: '#ffffff', // white
  secondaryTextColor: '#9ca3af', // gray-400
  accentColor: '#3b82f6', // blue-500
};

const defaultSettings: Settings = {
  todayAnimation: { ...defaultPanelAnimation },
  tomorrowAnimation: { ...defaultPanelAnimation },
  todayCTOAnimation: { ...defaultPanelAnimation },
  todayWFHAnimation: { ...defaultPanelAnimation },
  todayTravelAnimation: { ...defaultPanelAnimation },
  tomorrowCategoryAnimation: { ...defaultPanelAnimation },
  colors: defaultColors,
  theme: defaultThemeSettings,
};

// Helper function to migrate settings to ensure all fields exist
function migrateSettings(settings: Partial<Settings> | undefined): Settings {
  const defaultAnimation: PanelAnimation = { type: 'static', enabled: false, interval: 5 };
  
  // If settings is undefined or null, return defaults
  if (!settings) {
    return { ...defaultSettings };
  }
  
  // Create a copy to avoid mutating the input
  const migrated: Settings = {
    todayAnimation: settings.todayAnimation || { ...defaultAnimation },
    tomorrowAnimation: settings.tomorrowAnimation || { ...defaultAnimation },
    todayCTOAnimation: settings.todayCTOAnimation || settings.todayCategoryAnimation || { ...defaultAnimation },
    todayWFHAnimation: settings.todayWFHAnimation || settings.todayCategoryAnimation || { ...defaultAnimation },
    todayTravelAnimation: settings.todayTravelAnimation || settings.todayCategoryAnimation || { ...defaultAnimation },
    tomorrowCategoryAnimation: settings.tomorrowCategoryAnimation || { ...defaultAnimation },
    colors: settings.colors ? { ...settings.colors } : { ...defaultColors },
    theme: settings.theme ? { ...settings.theme } : { ...defaultThemeSettings },
  };
  
  return migrated;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      events: [],
      settings: defaultSettings,
      isAdmin: false,
      isLoading: true,
      isPinProtected: false,

      setEvents: (events) => set({ events }),
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      updateEvent: (id, updatedEvent) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...updatedEvent } : e
          ),
        })),
      deleteEvent: (id) =>
        set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
      setSettings: (newSettings) =>
        set((state) => ({ settings: migrateSettings({ ...state.settings, ...newSettings }) })),
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setIsPinProtected: (isPinProtected) => set({ isPinProtected }),
    }),
    {
      name: 'eustdd-calendar-settings', // localStorage key
      partialize: (state) => ({ settings: state.settings }), // Only persist settings
      merge: (persistedState, currentState) => {
        // Merge persisted settings with defaults to ensure all fields exist
        try {
          const persisted = persistedState as Partial<CalendarState>;
          return {
            ...currentState,
            ...persisted,
            settings: migrateSettings(persisted?.settings),
          };
        } catch (error) {
          console.error('Error merging persisted state:', error);
          // Return default state if there's an error
          return {
            ...currentState,
            settings: { ...defaultSettings },
          };
        }
      },
      storage: {
        getItem: (name) => {
          try {
            // Check if we're on the client side
            if (typeof window === 'undefined') return null;
            const str = localStorage.getItem(name);
            if (!str) return null;
            return JSON.parse(str);
          } catch (error) {
            console.error('Error reading from localStorage:', error);
            // Clear corrupted data (only on client)
            if (typeof window !== 'undefined') {
              try {
                localStorage.removeItem(name);
              } catch {}
            }
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            // Only write on client side
            if (typeof window !== 'undefined') {
              localStorage.setItem(name, JSON.stringify(value));
            }
          } catch (error) {
            console.error('Error writing to localStorage:', error);
          }
        },
        removeItem: (name) => {
          try {
            // Only remove on client side
            if (typeof window !== 'undefined') {
              localStorage.removeItem(name);
            }
          } catch (error) {
            console.error('Error removing from localStorage:', error);
          }
        },
      },
    }
  )
);
