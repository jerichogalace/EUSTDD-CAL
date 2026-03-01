'use client';

// EUSTDD Calendar System - Delete Confirmation Dialog Implementation
import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isSameMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  XCircle,
  XIcon,
  User,
  BellRing,
  Monitor,
  Play,
  Pause,
  Sun,
  Moon,
  Eye,
  SunMoon,
  Sparkles,
  Sliders,
  Plus,
  Minus,
  FolderKanban,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCalendarStore, type CalendarEvent, type EventStatus, type EventCategory, type Settings, type PanelAnimation, type AnimationType, type ThemeSettings, type ThemeMode } from '@/store/calendar-store';

// Status color mapping
const getStatusColor = (status: EventStatus, colors: Settings['colors']) => {
  return colors[status] || colors.upcoming;
};

// Convert 24-hour time to 12-hour format with AM/PM
const formatTimeTo12Hour = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Format time range for display
const formatTimeRange = (startTime: string, endTime?: string | null): string => {
  const start = formatTimeTo12Hour(startTime);
  if (endTime) {
    return `${start} - ${formatTimeTo12Hour(endTime)}`;
  }
  return start;
};

// Notification sound generator using Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    // Create a pleasant chime sound
    const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.3) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = audioContext.currentTime;
    
    // Play a pleasant ascending chime (C5 -> E5 -> G5 -> C6)
    playTone(523.25, now, 0.3, 0.25);           // C5
    playTone(659.25, now + 0.15, 0.3, 0.25);    // E5
    playTone(783.99, now + 0.3, 0.3, 0.25);     // G5
    playTone(1046.50, now + 0.45, 0.4, 0.3);    // C6
    
  } catch (error) {
    console.log('Audio notification not available:', error);
  }
}

// Notification Bar Component - Simple notification popup
function NotificationBar({ 
  event 
}: { 
  event: CalendarEvent; 
}) {
  const timeDisplay = formatTimeRange(event.time, event.timeEnd);

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="fixed top-0 left-0 right-0 z-[100] flex justify-center pt-4 px-4"
    >
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl shadow-2xl px-8 py-5 flex items-center gap-5 max-w-xl w-full border-4 border-green-300">
        <div className="flex-shrink-0">
          <motion.div
            animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.5 }}
          >
            <BellRing className="w-10 h-10 text-yellow-300 drop-shadow-lg" />
          </motion.div>
        </div>
        <div className="flex-1 min-w-0 text-center">
          <span className="text-xs font-bold uppercase tracking-widest bg-white/30 px-3 py-1 rounded-full">EVENT STARTING NOW</span>
          <h3 className="text-2xl font-bold truncate mt-2">{event.title}</h3>
          <div className="flex items-center justify-center gap-4 text-sm text-green-50 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {timeDisplay}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Event Card Component - with hover actions
function EventCard({
  event,
  colors,
  fontSize,
  themeMode,
  onEdit,
  onDelete,
  onCancel,
}: {
  event: CalendarEvent;
  colors: Settings['colors'];
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  fontSize?: ThemeSettings['fontSize'];
  themeMode?: ThemeMode;
}) {
  const statusColor = getStatusColor(event.status, colors);
  const isCancelled = event.status === 'cancelled';
  const isLight = themeMode === 'light';

  // Get font size class
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      case 'extra-large': return 'text-xl';
      default: return 'text-base';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`group flex items-center gap-3 p-3 rounded-lg transition-colors ${isCancelled ? 'bg-gray-800/30 opacity-50' : isLight ? 'bg-gray-200/50 hover:bg-gray-300/50' : 'bg-white/5 hover:bg-white/10'}`}
    >
      <div
        className="w-2 h-12 rounded-full flex-shrink-0"
        style={{ backgroundColor: statusColor }}
      />
      <div className="flex-1 min-w-0">
        <h3 className={`font-medium truncate ${getFontSizeClass()} ${isCancelled ? 'text-gray-500 line-through' : isLight ? 'text-gray-800' : 'text-white'}`}>{event.title}</h3>
        <div className={`flex items-center gap-3 ${isLight ? 'text-gray-600' : 'text-gray-400'} text-sm`}>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTimeRange(event.time, event.timeEnd)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5" />
              {event.location}
            </span>
          )}
        </div>
      </div>
      {/* Hover Actions - pointer-events-none to prevent ghost touches */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(event); }}
            className={`p-1.5 rounded-md transition-colors pointer-events-auto ${isLight ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-500/20 text-blue-400'}`}
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}
        {onCancel && !isCancelled && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(event.id); }}
            className={`p-1.5 rounded-md transition-colors pointer-events-auto ${isLight ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-amber-500/20 text-amber-400'}`}
            title="Cancel"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
            className={`p-1.5 rounded-md transition-colors pointer-events-auto ${isLight ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-500/20 text-red-400'}`}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Continuous Scroll Component - Movie credits style scrolling
function ContinuousScroll({
  items,
  direction,
  interval,
  renderItem,
  itemsKey,
}: {
  items: CalendarEvent[];
  direction: 'up' | 'down';
  interval: number;
  renderItem: (item: CalendarEvent) => React.ReactNode;
  itemsKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Fixed smooth scroll duration (20 seconds per cycle for normal speed)
  // The interval parameter is used for page-based animations, not continuous scroll
  const SCROLL_DURATION = 20;

  // Calculate height after render and when key changes
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const firstSet = containerRef.current.querySelector('[data-first-set]') as HTMLElement;
        if (firstSet) {
          setContentHeight(firstSet.offsetHeight);
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [itemsKey]);

  if (items.length === 0) return null;

  return (
    <div className="relative h-full overflow-hidden">
      <motion.div
        key={itemsKey}
        ref={containerRef}
        className="absolute w-full"
        initial={{ y: 0 }}
        animate={{
          y: direction === 'up' ? [0, -contentHeight || 0] : [-(contentHeight || 0), 0],
        }}
        transition={{
          duration: SCROLL_DURATION,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
        }}
      >
        <div data-first-set className="space-y-1">
          {items.map((item) => (
            <div key={`first-${item.id}`}>{renderItem(item)}</div>
          ))}
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <div key={`second-${item.id}`}>{renderItem(item)}</div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Category Mini Panel with animations - TV Display Mode (shows 4 items at a time)
function CategoryMiniPanel({
  title,
  events,
  animation,
  fontSize,
  themeMode,
  onEditEntry,
  onDeleteEntry,
  onCancelEntry,
}: {
  title: string;
  events: CalendarEvent[];
  onEditEntry?: (event: CalendarEvent) => void;
  onDeleteEntry?: (id: string) => void;
  onCancelEntry?: (id: string) => void;
  animation: PanelAnimation;
  fontSize: ThemeSettings['fontSize'];
  themeMode: ThemeMode;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 4;
  const isLight = themeMode === 'light';
  
  const categoryColors: Record<string, string> = {
    cto: '#f59e0b',
    wfh: '#8b5cf6',
    travel: '#06b6d4',
  };

  // Filter out expired entries based on endDate
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for comparison
  
  const activeEvents = events.filter((event) => {
    // If no endDate, check if the start date is today or in the future
    if (!event.endDate) {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    }
    // If has endDate, check if endDate is today or in the future
    const endDate = new Date(event.endDate);
    endDate.setHours(0, 0, 0, 0);
    return endDate >= today;
  });

  // Get font size class
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-base';
      case 'extra-large': return 'text-lg';
      default: return 'text-sm';
    }
  };

  // Get animation variants based on type
  const getAnimationVariants = () => {
    switch (animation.type) {
      case 'scroll-up': return { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -30 } };
      case 'scroll-down': return { initial: { opacity: 0, y: -30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 30 } };
      case 'fade': return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
      case 'slide-left': return { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } };
      case 'slide-right': return { initial: { opacity: 0, x: -30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 30 } };
      case 'flip': return { initial: { opacity: 0, rotateX: 90 }, animate: { opacity: 1, rotateX: 0 }, exit: { opacity: 0, rotateX: -90 } };
      case 'bounce': return { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } };
      default: return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    }
  };

  // Get interval duration in milliseconds
  const getIntervalDuration = () => {
    return (animation.interval || 5) * 1000;
  };

  // Calculate total pages based on active events
  const totalPages = Math.ceil(activeEvents.length / ITEMS_PER_PAGE);

  // Get current page events
  const getCurrentPageEvents = () => {
    const start = currentPage * ITEMS_PER_PAGE;
    return activeEvents.slice(start, start + ITEMS_PER_PAGE);
  };

  // Continuous animation effect - paginate through items
  useEffect(() => {
    // Skip for static, disabled, or continuous scroll types (they have their own animation)
    if (!animation.enabled || animation.type === 'static' ||
        animation.type === 'continuous-scroll-up' || animation.type === 'continuous-scroll-down') {
      return;
    }

    if (totalPages <= 1) return;

    const intervalDuration = getIntervalDuration();
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [animation, totalPages]);

  // Reset to page 0 when events change
  useEffect(() => {
    setCurrentPage(0);
  }, [activeEvents]);

  // Render event item - with action buttons
  const renderEventItem = (event: CalendarEvent) => {
    // For CTO, WFH, Travel entries - show date range instead of time
    const isDateRangeEntry = event.category === 'cto' || event.category === 'wfh' || event.category === 'travel';
    const displayText = isDateRangeEntry && event.endDate
      ? `${format(new Date(event.date), 'MMM d')} - ${format(new Date(event.endDate), 'MMM d')}`
      : isDateRangeEntry
        ? format(new Date(event.date), 'MMM d, yyyy')
        : formatTimeRange(event.time, event.timeEnd);

    return (
      <div
        key={event.id}
        className={`flex items-center gap-2 py-1.5 px-2 rounded ${isLight ? 'bg-gray-200/50' : 'bg-white/5'}`}
      >
        <div
          className="w-1.5 h-6 rounded-full flex-shrink-0"
          style={{ backgroundColor: categoryColors[title.toLowerCase()] }}
        />
        <div className="flex-1 min-w-0">
          <p className={`${isLight ? 'text-gray-800' : 'text-white'} truncate ${getFontSizeClass()}`}>{event.title}</p>
          <p className={`${isLight ? 'text-gray-600' : 'text-gray-400'} text-xs truncate`}>
            {displayText}
          </p>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onEditEntry && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditEntry(event); }}
              className={`p-1 rounded transition-colors ${isLight ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-500/20 text-blue-400'}`}
              title="Edit"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
          {onDeleteEntry && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteEntry(event.id); }}
              className={`p-1 rounded transition-colors ${isLight ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-500/20 text-red-400'}`}
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render animated content - show 4 items at a time
  const renderAnimatedContent = () => {
    // Continuous scroll animation
    if (animation.enabled && (animation.type === 'continuous-scroll-up' || animation.type === 'continuous-scroll-down') && activeEvents.length > 0) {
      return (
        <ContinuousScroll
          items={activeEvents}
          direction={animation.type === 'continuous-scroll-up' ? 'up' : 'down'}
          interval={animation.interval || 5}
          renderItem={renderEventItem}
          itemsKey={activeEvents.map(e => e.id).join('-')}
        />
      );
    }

    // Page-based animations (scroll-up, scroll-down, fade, slide-left, slide-right, flip, bounce)
    if (animation.enabled && animation.type !== 'static' &&
        animation.type !== 'continuous-scroll-up' && animation.type !== 'continuous-scroll-down' &&
        activeEvents.length > 0) {
      const pageEvents = getCurrentPageEvents();
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={getAnimationVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.4 }}
            className="space-y-1"
          >
            {pageEvents.map((event) => renderEventItem(event))}
          </motion.div>
        </AnimatePresence>
      );
    }

    // Static view - show all events (max 4 visible)
    return (
      <div className="space-y-1">
        {activeEvents.slice(0, ITEMS_PER_PAGE).map((event) => renderEventItem(event))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`flex-shrink-0 flex items-center justify-between py-2 px-3 border-b ${isLight ? 'border-gray-300' : 'border-gray-700'}`}>
        <span
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: categoryColors[title.toLowerCase()] || (isLight ? '#374151' : '#fff') }}
        >
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {animation.enabled && animation.type !== 'static' && totalPages > 1 && (
            <span className={`text-[10px] ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{currentPage + 1}/{totalPages}</span>
          )}
        </div>
      </div>
      <div className="p-2 overflow-hidden" style={{ height: 'calc(100% - 40px)' }}>
        {activeEvents.length === 0 ? (
          <p className={`text-xs text-center py-3 ${isLight ? 'text-gray-400' : 'text-gray-600'}`}>No entries</p>
        ) : (
          renderAnimatedContent()
        )}
      </div>
    </div>
  );
}

// Schedule Panel Component - TV Display Mode (shows 3 events at a time)
function SchedulePanel({
  title,
  events,
  colors,
  animation,
  ctoAnimation,
  wfhAnimation,
  travelAnimation,
  ctoEvents,
  wfhEvents,
  travelEvents,
  fontSize,
  themeMode,
  onEditEvent,
  onDeleteEvent,
  onCancelEvent,
}: {
  title: string;
  events: CalendarEvent[];
  colors: Settings['colors'];
  animation: PanelAnimation;
  ctoAnimation: PanelAnimation;
  wfhAnimation: PanelAnimation;
  travelAnimation: PanelAnimation;
  ctoEvents: CalendarEvent[];
  wfhEvents: CalendarEvent[];
  travelEvents: CalendarEvent[];
  fontSize: ThemeSettings['fontSize'];
  themeMode: ThemeMode;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  onCancelEvent?: (id: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const EVENTS_PER_PAGE = 3;

  // Get font size class
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      case 'extra-large': return 'text-xl';
      default: return 'text-base';
    }
  };

  // Get animation variants based on type
  const getAnimationVariants = () => {
    switch (animation.type) {
      case 'scroll-up': return { initial: { opacity: 0, y: 50 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -50 } };
      case 'scroll-down': return { initial: { opacity: 0, y: -50 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 50 } };
      case 'fade': return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
      case 'slide-left': return { initial: { opacity: 0, x: 50 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -50 } };
      case 'slide-right': return { initial: { opacity: 0, x: -50 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 50 } };
      case 'flip': return { initial: { opacity: 0, rotateX: 90 }, animate: { opacity: 1, rotateX: 0 }, exit: { opacity: 0, rotateX: -90 } };
      case 'bounce': return { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } };
      default: return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    }
  };

  // Get interval duration in milliseconds
  const getIntervalDuration = () => {
    return (animation.interval || 5) * 1000;
  };

  // Calculate total pages
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);

  // Get current page events
  const getCurrentPageEvents = () => {
    const start = currentPage * EVENTS_PER_PAGE;
    return events.slice(start, start + EVENTS_PER_PAGE);
  };

  // Continuous animation effect - paginate through events
  useEffect(() => {
    // Skip for static, disabled, or continuous scroll types (they have their own animation)
    if (!animation.enabled || animation.type === 'static' ||
        animation.type === 'continuous-scroll-up' || animation.type === 'continuous-scroll-down') {
      return;
    }

    if (totalPages <= 1) return;

    const intervalDuration = getIntervalDuration();
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [animation, totalPages]);

  // Reset to page 0 when events change
  useEffect(() => {
    setCurrentPage(0);
  }, [events]);

  // Render animated content - show 3 events at a time
  const renderAnimatedEvents = () => {
    // Continuous scroll animation
    if (animation.enabled && (animation.type === 'continuous-scroll-up' || animation.type === 'continuous-scroll-down') && events.length > 0) {
      return (
        <ContinuousScroll
          items={events}
          direction={animation.type === 'continuous-scroll-up' ? 'up' : 'down'}
          interval={animation.interval || 5}
          itemsKey={events.map(e => e.id).join('-')}
          renderItem={(event) => (
            <EventCard
              key={event.id}
              event={event}
              colors={colors}
              fontSize={fontSize}
              themeMode={themeMode}
              onEdit={onEditEvent}
              onDelete={onDeleteEvent}
              onCancel={onCancelEvent}
            />
          )}
        />
      );
    }

    // Page-based animations (scroll-up, scroll-down, fade, slide-left, slide-right, flip, bounce)
    if (animation.enabled && animation.type !== 'static' &&
        animation.type !== 'continuous-scroll-up' && animation.type !== 'continuous-scroll-down' &&
        events.length > 0) {
      const pageEvents = getCurrentPageEvents();
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={getAnimationVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            {pageEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                colors={colors}
                fontSize={fontSize}
                themeMode={themeMode}
                onEdit={onEditEvent}
                onDelete={onDeleteEvent}
                onCancel={onCancelEvent}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      );
    }

    // Static view - show all events (max 3 visible)
    return (
      <div className="space-y-2">
        {events.slice(0, EVENTS_PER_PAGE).map((event) => (
          <EventCard
            key={event.id}
            event={event}
            colors={colors}
            fontSize={fontSize}
            themeMode={themeMode}
            onEdit={onEditEvent}
            onDelete={onDeleteEvent}
            onCancel={onCancelEvent}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Schedule Section - Fixed height for 3 events */}
      <Card className={`${themeMode === 'light' ? 'bg-white/80 border-gray-300' : 'bg-gray-900/80 border-gray-700'} flex-shrink-0`} style={{ height: '420px' }}>
        <CardHeader className={`flex-shrink-0 border-b py-2 px-4 ${themeMode === 'light' ? 'border-gray-300' : 'border-gray-700'}`}>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-lg font-bold ${themeMode === 'light' ? 'text-gray-800' : 'text-white'} tracking-widest uppercase`}>
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              {animation.enabled && animation.type !== 'static' && totalPages > 1 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${themeMode === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-600/30 text-blue-400'}`}>
                  {currentPage + 1}/{totalPages}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden p-3" style={{ height: '368px' }}>
          {events.length === 0 ? (
            <div className={`flex items-center justify-center h-full ${themeMode === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              <p className="text-base">No events scheduled</p>
            </div>
          ) : (
            renderAnimatedEvents()
          )}
        </CardContent>
      </Card>

      {/* CTO | WFH | TRAVEL Section - Fixed height for 4 items */}
      <div className="flex-shrink-0 mt-2" style={{ height: '280px' }}>
        <Card className={`${themeMode === 'light' ? 'bg-white/80 border-gray-300' : 'bg-gray-900/80 border-gray-700'} h-full`}>
          <div className={`grid grid-cols-3 divide-x ${themeMode === 'light' ? 'divide-gray-300' : 'divide-gray-700'} h-full`}>
            <CategoryMiniPanel
              title="CTO"
              events={ctoEvents}
              animation={ctoAnimation}
              fontSize={fontSize}
              themeMode={themeMode}
              onEditEntry={onEditEvent}
              onDeleteEntry={onDeleteEvent}
              onCancelEntry={onCancelEvent}
            />
            <CategoryMiniPanel
              title="WFH"
              events={wfhEvents}
              animation={wfhAnimation}
              fontSize={fontSize}
              themeMode={themeMode}
              onEditEntry={onEditEvent}
              onDeleteEntry={onDeleteEvent}
              onCancelEntry={onCancelEvent}
            />
            <CategoryMiniPanel
              title="TRAVEL"
              events={travelEvents}
              animation={travelAnimation}
              fontSize={fontSize}
              themeMode={themeMode}
              onEditEntry={onEditEvent}
              onDeleteEntry={onDeleteEvent}
              onCancelEntry={onCancelEvent}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// Delete Confirmation Dialog
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-900 border-gray-700 text-white'} max-w-sm`}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-red-500">Confirm Delete</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className={isLight ? 'text-gray-600' : 'text-gray-300'}>
            Are you sure you want to delete <span className={`font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>{itemName}</span>?
          </p>
          <p className={`${isLight ? 'text-gray-500' : 'text-gray-500'} text-sm mt-2`}>This action cannot be undone.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className={`${isLight ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400'} px-6`}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 px-6">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// CTO/WFH Entry Modal (Name, Date, Time, Details)
function CTOWFHModal({
  isOpen,
  onClose,
  onSave,
  event,
  entryType,
  defaultDate,
  onDelete,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (id: string) => void;
  event?: CalendarEvent | null;
  entryType: 'cto' | 'wfh';
  defaultDate: Date;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  const [formData, setFormData] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    description: '',
  });

  useEffect(() => {
    if (event?.id) {
      setFormData({
        title: event.title,
        date: format(new Date(event.date), 'yyyy-MM-dd'),
        endDate: event.endDate ? format(new Date(event.endDate), 'yyyy-MM-dd') : '',
        description: event.description || '',
      });
    } else {
      setFormData({
        title: '',
        date: format(defaultDate, 'yyyy-MM-dd'),
        endDate: '',
        description: '',
      });
    }
  }, [event, defaultDate]);

  // Handle add - keeps form open for more entries
  const handleAdd = () => {
    if (!formData.title.trim()) return;
    onSave({
      title: formData.title,
      date: new Date(formData.date),
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      time: '00:00', // Default time since we removed time fields
      timeEnd: null,
      description: formData.description,
      status: 'upcoming',
      category: entryType,
    });
    // Reset form for next entry but keep modal open
    setFormData({
      title: '',
      date: format(defaultDate, 'yyyy-MM-dd'),
      endDate: '',
      description: '',
    });
  };

  // Handle update - closes form after editing
  const handleUpdate = () => {
    if (!formData.title.trim()) return;
    onSave({
      title: formData.title,
      date: new Date(formData.date),
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      time: '00:00',
      timeEnd: null,
      description: formData.description,
      status: 'upcoming',
      category: entryType,
    });
    onClose();
  };

  const titleText = entryType === 'cto' ? 'CTO/FL Entry' : 'WFH Entry';
  const labelText = entryType === 'cto' ? 'Compensatory Time Off / Force Leave' : 'Work From Home';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-900 border-gray-700 text-white'} max-w-md`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {event?.id ? `EDIT ${titleText.toUpperCase()}` : `ADD ${titleText.toUpperCase()}`}
          </DialogTitle>
          <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-sm`}>{labelText}</p>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2`}>
              <User className="w-4 h-4" />
              Name of Person *
            </Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter name"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}
            />
          </div>
          <div className={`${isLight ? 'bg-gray-100 border-gray-200' : 'bg-gray-800/50 border-gray-700'} rounded-lg p-4 border`}>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-3`}>
              <CalendarIcon className="w-4 h-4" />
              Date Range (Start - End) *
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'} h-11 w-full`}
                />
              </div>
              <span className={`${isLight ? 'text-gray-500' : 'text-gray-500'} font-medium`}>to</span>
              <div className="flex-1">
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'} h-11 w-full`}
                  placeholder="End Date"
                />
              </div>
            </div>
          </div>
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Details / Notes</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter additional details (optional)"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2`}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {event?.id && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(event.id); onClose(); }} className="bg-red-600 hover:bg-red-700 px-6">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className={`${isLight ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400'} px-6`}>Cancel</Button>
          {event?.id ? (
            <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 px-8">UPDATE</Button>
          ) : (
            <>
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 px-6">ADD</Button>
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 px-6">DONE</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Travel Entry Modal (Name, Location, Date, Time, Details)
function TravelModal({
  isOpen,
  onClose,
  onSave,
  event,
  defaultDate,
  onDelete,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (id: string) => void;
  event?: CalendarEvent | null;
  defaultDate: Date;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    description: '',
  });

  useEffect(() => {
    if (event?.id) {
      setFormData({
        title: event.title,
        location: event.location || '',
        date: format(new Date(event.date), 'yyyy-MM-dd'),
        endDate: event.endDate ? format(new Date(event.endDate), 'yyyy-MM-dd') : '',
        description: event.description || '',
      });
    } else {
      setFormData({
        title: '',
        location: '',
        date: format(defaultDate, 'yyyy-MM-dd'),
        endDate: '',
        description: '',
      });
    }
  }, [event, defaultDate]);

  // Handle add - keeps form open for more entries
  const handleAdd = () => {
    if (!formData.title.trim()) return;
    onSave({
      title: formData.title,
      date: new Date(formData.date),
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      time: '00:00', // Default time since we removed time fields
      timeEnd: null,
      location: formData.location,
      description: formData.description,
      status: 'upcoming',
      category: 'travel',
    });
    // Reset form for next entry but keep modal open
    setFormData({
      title: '',
      location: '',
      date: format(defaultDate, 'yyyy-MM-dd'),
      endDate: '',
      description: '',
    });
  };

  // Handle update - closes form after editing
  const handleUpdate = () => {
    if (!formData.title.trim()) return;
    onSave({
      title: formData.title,
      date: new Date(formData.date),
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      time: '00:00',
      timeEnd: null,
      location: formData.location,
      description: formData.description,
      status: 'upcoming',
      category: 'travel',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-900 border-gray-700 text-white'} max-w-md`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {event?.id ? 'EDIT TRAVEL ENTRY' : 'ADD TRAVEL ENTRY'}
          </DialogTitle>
          <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-sm`}>Business Travel</p>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2`}>
              <User className="w-4 h-4" />
              Name of Person *
            </Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter name"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}
            />
          </div>
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2`}>
              <MapPin className="w-4 h-4" />
              Destination / Location *
            </Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Where are they traveling to?"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}
            />
          </div>
          <div className={`${isLight ? 'bg-gray-100 border-gray-200' : 'bg-gray-800/50 border-gray-700'} rounded-lg p-4 border`}>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-3`}>
              <CalendarIcon className="w-4 h-4" />
              Date Range (Start - End) *
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'} h-11 w-full`}
                />
              </div>
              <span className={`${isLight ? 'text-gray-500' : 'text-gray-500'} font-medium`}>to</span>
              <div className="flex-1">
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'} h-11 w-full`}
                  placeholder="End Date"
                />
              </div>
            </div>
          </div>
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Details / Purpose</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Purpose of travel, additional details (optional)"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2`}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {event?.id && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(event.id); onClose(); }} className="bg-red-600 hover:bg-red-700 px-6">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className={`${isLight ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400'} px-6`}>Cancel</Button>
          {event?.id ? (
            <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 px-8">UPDATE</Button>
          ) : (
            <>
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 px-6">ADD</Button>
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 px-6">DONE</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Schedule Event Modal (without Status dropdown)
function ScheduleModal({
  isOpen,
  onClose,
  onSave,
  event,
  defaultDate,
  onDelete,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (id: string) => void;
  event?: CalendarEvent | null;
  defaultDate: Date;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  const [formData, setFormData] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    timeEnd: '',
    location: '',
    description: '',
  });

  useEffect(() => {
    if (event?.id) {
      setFormData({
        title: event.title,
        date: format(new Date(event.date), 'yyyy-MM-dd'),
        time: event.time,
        timeEnd: event.timeEnd || '',
        location: event.location || '',
        description: event.description || '',
      });
    } else {
      setFormData({
        title: '',
        date: format(defaultDate, 'yyyy-MM-dd'),
        time: '09:00',
        timeEnd: '',
        location: '',
        description: '',
      });
    }
  }, [event, defaultDate]);

  // Handle add - keeps form open for more entries
  const handleAdd = () => {
    if (!formData.title.trim()) return;
    onSave({
      title: formData.title,
      date: new Date(formData.date),
      time: formData.time,
      timeEnd: formData.timeEnd || null,
      location: formData.location,
      description: formData.description,
      status: 'upcoming',
      category: 'schedule',
    });
    // Reset form for next entry but keep modal open
    setFormData({
      title: '',
      date: format(defaultDate, 'yyyy-MM-dd'),
      time: '09:00',
      timeEnd: '',
      location: '',
      description: '',
    });
  };

  // Handle update - closes form after editing
  const handleUpdate = () => {
    if (!formData.title.trim()) return;
    onSave({
      title: formData.title,
      date: new Date(formData.date),
      time: formData.time,
      timeEnd: formData.timeEnd || null,
      location: formData.location,
      description: formData.description,
      status: 'upcoming',
      category: 'schedule',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-900 border-gray-700 text-white'} max-w-lg`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {event?.id ? 'EDIT EVENT' : 'ADD NEW EVENT'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Event Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter event title"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}
            />
          </div>
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Date *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}
            />
          </div>
          <div className={`${isLight ? 'bg-gray-100 border-gray-200' : 'bg-gray-800/50 border-gray-700'} rounded-lg p-4 border`}>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-3`}>
              <Clock className="w-4 h-4" />
              Time (Start - End)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'} h-11 flex-1`}
              />
              <span className={`${isLight ? 'text-gray-500' : 'text-gray-500'} font-medium`}>to</span>
              <Input
                type="time"
                value={formData.timeEnd}
                onChange={(e) => setFormData({ ...formData, timeEnd: e.target.value })}
                className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'} h-11 flex-1`}
                placeholder="End"
              />
            </div>
          </div>
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Location</Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Enter location (optional)"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}
            />
          </div>
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description (optional)"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2`}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {event?.id && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(event.id); onClose(); }} className="bg-red-600 hover:bg-red-700 px-6">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className={`${isLight ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400'} px-6`}>Cancel</Button>
          {event?.id ? (
            <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 px-8">UPDATE</Button>
          ) : (
            <>
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 px-6">ADD</Button>
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 px-6">DONE</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Project Request type
interface ProjectRequestItem {
  id: string;
  name: string;
  number: number;
  status?: 'pending' | 'approved' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | null;
  createdAt: Date;
  updatedAt: Date;
}

// Project Request Modal
function ProjectRequestModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  project,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Partial<ProjectRequestItem>) => void;
  onDelete?: (id: string) => void;
  project?: ProjectRequestItem | null;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  const [formData, setFormData] = useState({
    name: '',
    number: '1',
    status: null as ProjectRequestItem['status'],
  });

  useEffect(() => {
    if (project?.id) {
      setFormData({
        name: project.name,
        number: project.number,
        status: project.status || null,
      });
    } else {
      setFormData({
        name: '',
        number: '1',
        status: null,
      });
    }
  }, [project]);

  // Handle add - keeps form open for more entries
  const handleAdd = () => {
    if (!formData.name.trim()) return;
    onSave({
      name: formData.name,
      number: formData.number,
      status: formData.status,
    });
    // Reset form for next entry but keep modal open
    setFormData({
      name: '',
      number: '1',
      status: null,
    });
  };

  // Handle update - closes form after editing
  const handleUpdate = () => {
    if (!formData.name.trim()) return;
    onSave({
      name: formData.name,
      number: formData.number,
      status: formData.status,
    });
    onClose();
  };

  const statusOptions: { value: ProjectRequestItem['status']; label: string; color: string }[] = [
    { value: null, label: 'None', color: '#6b7280' },
    { value: 'pending', label: 'Pending', color: '#f59e0b' },
    { value: 'approved', label: 'Approved', color: '#22c55e' },
    { value: 'in-progress', label: 'In Progress', color: '#3b82f6' },
    { value: 'on-hold', label: 'On Hold', color: '#8b5cf6' },
    { value: 'completed', label: 'Completed', color: '#10b981' },
    { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-900 border-gray-700 text-white'} max-w-md`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {project?.id ? 'EDIT PROJECT REQUEST' : 'ADD PROJECT REQUEST'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}
            />
          </div>
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Number</Label>
            <div className="flex items-center gap-3 mt-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setFormData({ ...formData, number: String(Math.max(1, parseInt(formData.number) - 1 || 0)) })}
                className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} h-12 w-12`}
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Input
                type="text"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value.replace(/[^0-9]/g, '') || '1' })}
                className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} h-12 text-center flex-1`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setFormData({ ...formData, number: String(parseInt(formData.number) + 1 || 1) })}
                className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} h-12 w-12`}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Status (Optional)</Label>
            <Select
              value={formData.status || 'none'}
              onValueChange={(value) => setFormData({ ...formData, status: value === 'none' ? null : value as ProjectRequestItem['status'] })}
            >
              <SelectTrigger className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'} mt-2 h-12`}>
                <SelectValue placeholder="Select status (optional)" />
              </SelectTrigger>
              <SelectContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'}`}>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value || 'none'} value={option.value || 'none'} className={isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-600'}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: option.color }} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {project?.id && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(project.id); onClose(); }} className="bg-red-600 hover:bg-red-700 px-6">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className={`${isLight ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400'} px-6`}>Cancel</Button>
          {project?.id ? (
            <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 px-8">UPDATE</Button>
          ) : (
            <>
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 px-6">ADD</Button>
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 px-6">DONE</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Project Request Panel Component - 2 Column Layout (Page 1 | Page 2)
function ProjectRequestPanel({
  projects,
  fontSize,
  themeMode,
  animation,
  onEditProject,
  onDeleteProject,
}: {
  projects: ProjectRequestItem[];
  fontSize: ThemeSettings['fontSize'];
  themeMode: ThemeMode;
  animation: PanelAnimation;
  onEditProject: (project: ProjectRequestItem) => void;
  onDeleteProject: (id: string) => void;
}) {
  const isLight = themeMode === 'light';
  const ITEMS_PER_PAGE = 4; // 4 items per page/column
  const ITEMS_PER_VIEW = 8; // Total 8 items visible (Page 1 + Page 2)
  const [currentPageSet, setCurrentPageSet] = useState(0);

  const statusColors: Record<string, string> = {
    'pending': '#f59e0b',
    'approved': '#22c55e',
    'in-progress': '#3b82f6',
    'on-hold': '#8b5cf6',
    'completed': '#10b981',
    'cancelled': '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    'pending': 'Pending',
    'approved': 'Approved',
    'in-progress': 'In Progress',
    'on-hold': 'On Hold',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
  };

  // Calculate total page sets (each set shows Page 1 + Page 2 = 8 items)
  const totalPageSets = Math.ceil(projects.length / ITEMS_PER_VIEW);

  // Get current view projects (8 items at a time)
  const getCurrentViewProjects = () => {
    const start = currentPageSet * ITEMS_PER_VIEW;
    return projects.slice(start, start + ITEMS_PER_VIEW);
  };

  // Split into two columns: Page 1 (first 4) and Page 2 (next 4)
  const currentProjects = getCurrentViewProjects();
  const page1Projects = currentProjects.slice(0, 4);
  const page2Projects = currentProjects.slice(4, 8);

  // Get animation variants based on type
  const getAnimationVariants = () => {
    switch (animation.type) {
      case 'scroll-up': return { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -30 } };
      case 'scroll-down': return { initial: { opacity: 0, y: -30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 30 } };
      case 'fade': return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
      case 'slide-left': return { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } };
      case 'slide-right': return { initial: { opacity: 0, x: -30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 30 } };
      case 'flip': return { initial: { opacity: 0, rotateX: 90 }, animate: { opacity: 1, rotateX: 0 }, exit: { opacity: 0, rotateX: -90 } };
      case 'bounce': return { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } };
      default: return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    }
  };

  // Auto-rotate page sets (only if more than 8 items)
  useEffect(() => {
    if (totalPageSets <= 1 || !animation.enabled) return;
    const intervalMs = (animation.interval || 5) * 1000;
    const interval = setInterval(() => {
      setCurrentPageSet((prev) => (prev + 1) % totalPageSets);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [totalPageSets, animation.enabled, animation.interval]);

  // Reset to page 0 when projects change
  useEffect(() => {
    setCurrentPageSet(0);
  }, [projects]);

  // Render project item with smaller font
  const renderProjectItem = (project: ProjectRequestItem) => (
    <div
      key={project.id}
      className={`flex items-start gap-2 p-1.5 rounded ${isLight ? 'bg-gray-200/50' : 'bg-white/5'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`${isLight ? 'text-gray-800' : 'text-white'} font-medium text-[11px] truncate flex-1 min-w-0`}>
            {project.name}
          </span>
          {project.status && statusColors[project.status] && (
            <span
              className="text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0"
              style={{
                backgroundColor: `${statusColors[project.status]}20`,
                color: statusColors[project.status]
              }}
            >
              {statusLabels[project.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-gray-400 text-[9px] flex-shrink-0">Count:</span>
          <span className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-[9px] font-medium`}>
            {project.number}
          </span>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {onEditProject && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
            className={`p-0.5 rounded transition-colors ${isLight ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-500/20 text-blue-400'}`}
            title="Edit"
          >
            <Edit3 className="w-2.5 h-2.5" />
          </button>
        )}
        {onDeleteProject && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
            className={`p-0.5 rounded transition-colors ${isLight ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-500/20 text-red-400'}`}
            title="Delete"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );

  // Render column content - shows 4 items per page
  const renderColumn = (columnProjects: ProjectRequestItem[], pageIndex: number, totalPages: number) => (
    <div className="flex flex-col h-full min-w-0">
      <div className={`text-[10px] font-semibold mb-1 px-1 flex items-center gap-1 flex-shrink-0 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        PAGE {pageIndex}
        {totalPages > 2 && pageIndex === 1 && (
          <span className="text-[8px] text-gray-500 ml-auto">of {totalPages}</span>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0">
        {columnProjects.length === 0 ? (
          <p className="text-gray-500 text-[10px] text-center py-2 italic">Empty</p>
        ) : (
          columnProjects.map((project) => renderProjectItem(project))
        )}
      </div>
    </div>
  );

  // Calculate total pages
  const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE);

  // Render content with animation
  const renderAnimatedContent = () => {
    // Continuous scroll animation
    if (animation.enabled && (animation.type === 'continuous-scroll-up' || animation.type === 'continuous-scroll-down') && projects.length > 0) {
      return (
        <div className="relative h-full overflow-hidden">
          <motion.div
            className="absolute w-full h-full"
            animate={{
              y: animation.type === 'continuous-scroll-up' ? [0, -100] : [-100, 0],
            }}
            transition={{
              duration: 20,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          >
            <div className="flex gap-3 h-full">
              <div className="flex-1 min-w-0">{renderColumn(page1Projects, 1, totalPages)}</div>
              <div className={`w-px flex-shrink-0 ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`} />
              <div className="flex-1 min-w-0">{renderColumn(page2Projects, 2, totalPages)}</div>
            </div>
          </motion.div>
        </div>
      );
    }

    // Page-based animations
    if (animation.enabled && animation.type !== 'static' && projects.length > 0) {
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPageSet}
            variants={getAnimationVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.4 }}
            className="flex gap-3 h-full"
          >
            <div className="flex-1 min-w-0">{renderColumn(page1Projects, currentPageSet * 2 + 1, totalPages)}</div>
            <div className={`w-px flex-shrink-0 ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`} />
            <div className="flex-1 min-w-0">{renderColumn(page2Projects, currentPageSet * 2 + 2, totalPages)}</div>
          </motion.div>
        </AnimatePresence>
      );
    }

    // Static view - Page 1 | Page 2
    return (
      <div className="flex gap-3 h-full">
        <div className="flex-1 min-w-0">{renderColumn(page1Projects, 1, totalPages)}</div>
        <div className={`w-px flex-shrink-0 ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`} />
        <div className="flex-1 min-w-0">{renderColumn(page2Projects, 2, totalPages)}</div>
      </div>
    );
  };

  return (
    <Card className={`${isLight ? 'bg-white/80 border-gray-300' : 'bg-gray-900/80 border-gray-700'} h-full flex flex-col`}>
      <div className={`flex items-center justify-between py-1.5 px-3 border-b flex-shrink-0 ${isLight ? 'border-gray-300' : 'border-gray-700'}`}>
        <span className="text-xs font-bold tracking-widest uppercase text-emerald-400 flex items-center gap-1.5">
          <FolderKanban className="w-3.5 h-3.5" />
          PROJECT REQUEST
        </span>
        <div className="flex items-center gap-2">
          {totalPageSets > 1 && animation.enabled && animation.type !== 'static' && (
            <span className="text-[10px] text-blue-400">Set {currentPageSet + 1}/{totalPageSets}</span>
          )}
          <span className="text-[10px] text-gray-400">{projects.length} entries</span>
        </div>
      </div>
      <div className="p-2 flex-1 min-h-0">
        {projects.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-3">No project requests</p>
        ) : (
          renderAnimatedContent()
        )}
      </div>
    </Card>
  );
}

// Tomorrow Panel - Schedule + Project Request
function TomorrowPanel({
  title,
  events,
  colors,
  animation,
  projectAnimation,
  projects,
  fontSize,
  themeMode,
  onEditEvent,
  onDeleteEvent,
  onCancelEvent,
  onEditProject,
  onDeleteProject,
}: {
  title: string;
  events: CalendarEvent[];
  colors: Settings['colors'];
  animation: PanelAnimation;
  projectAnimation: PanelAnimation;
  projects: ProjectRequestItem[];
  fontSize: ThemeSettings['fontSize'];
  themeMode: ThemeMode;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  onCancelEvent?: (id: string) => void;
  onEditProject: (project: ProjectRequestItem) => void;
  onDeleteProject: (id: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const EVENTS_PER_PAGE = 3;

  const isLight = themeMode === 'light';

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      case 'extra-large': return 'text-xl';
      default: return 'text-base';
    }
  };

  const getAnimationVariants = () => {
    switch (animation.type) {
      case 'scroll-up': return { initial: { opacity: 0, y: 50 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -50 } };
      case 'scroll-down': return { initial: { opacity: 0, y: -50 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 50 } };
      case 'fade': return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
      case 'slide-left': return { initial: { opacity: 0, x: 50 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -50 } };
      case 'slide-right': return { initial: { opacity: 0, x: -50 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 50 } };
      case 'flip': return { initial: { opacity: 0, rotateX: 90 }, animate: { opacity: 1, rotateX: 0 }, exit: { opacity: 0, rotateX: -90 } };
      case 'bounce': return { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } };
      default: return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    }
  };

  const getIntervalDuration = () => {
    return (animation.interval || 5) * 1000;
  };

  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);

  const getCurrentPageEvents = () => {
    const start = currentPage * EVENTS_PER_PAGE;
    return events.slice(start, start + EVENTS_PER_PAGE);
  };

  useEffect(() => {
    // Skip for static, disabled, or continuous scroll types (they have their own animation)
    if (!animation.enabled || animation.type === 'static' ||
        animation.type === 'continuous-scroll-up' || animation.type === 'continuous-scroll-down') {
      return;
    }

    if (totalPages <= 1) return;

    const intervalDuration = getIntervalDuration();
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, intervalDuration);

    return () => clearInterval(interval);
  }, [animation, totalPages]);

  useEffect(() => {
    setCurrentPage(0);
  }, [events]);

  const renderAnimatedEvents = () => {
    if (animation.enabled && (animation.type === 'continuous-scroll-up' || animation.type === 'continuous-scroll-down') && events.length > 0) {
      return (
        <ContinuousScroll
          items={events}
          direction={animation.type === 'continuous-scroll-up' ? 'up' : 'down'}
          interval={animation.interval || 5}
          itemsKey={events.map(e => e.id).join('-')}
          renderItem={(event) => (
            <EventCard
              key={event.id}
              event={event}
              colors={colors}
              fontSize={fontSize}
              themeMode={themeMode}
              onEdit={onEditEvent}
              onDelete={onDeleteEvent}
              onCancel={onCancelEvent}
            />
          )}
        />
      );
    }

    // Page-based animations (scroll-up, scroll-down, fade, slide-left, slide-right, flip, bounce)
    if (animation.enabled && animation.type !== 'static' &&
        animation.type !== 'continuous-scroll-up' && animation.type !== 'continuous-scroll-down' &&
        events.length > 0) {
      const pageEvents = getCurrentPageEvents();
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={getAnimationVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            {pageEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                colors={colors}
                fontSize={fontSize}
                themeMode={themeMode}
                onEdit={onEditEvent}
                onDelete={onDeleteEvent}
                onCancel={onCancelEvent}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      );
    }

    return (
      <div className="space-y-2">
        {events.slice(0, EVENTS_PER_PAGE).map((event) => (
          <EventCard
            key={event.id}
            event={event}
            colors={colors}
            fontSize={fontSize}
            themeMode={themeMode}
            onEdit={onEditEvent}
            onDelete={onDeleteEvent}
            onCancel={onCancelEvent}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Schedule Section */}
      <Card className={`${isLight ? 'bg-white/80 border-gray-300' : 'bg-gray-900/80 border-gray-700'} flex-shrink-0`} style={{ height: '420px' }}>
        <CardHeader className={`flex-shrink-0 border-b py-2 px-4 ${isLight ? 'border-gray-300' : 'border-gray-700'}`}>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'} tracking-widest uppercase`}>
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              {animation.enabled && animation.type !== 'static' && totalPages > 1 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-600/30 text-blue-400'}`}>
                  {currentPage + 1}/{totalPages}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden p-3" style={{ height: '368px' }}>
          {events.length === 0 ? (
            <div className={`flex items-center justify-center h-full ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>
              <p className="text-base">No events scheduled</p>
            </div>
          ) : (
            renderAnimatedEvents()
          )}
        </CardContent>
      </Card>

      {/* PROJECT REQUEST Section */}
      <div className="flex-shrink-0 mt-2" style={{ height: '280px' }}>
        <ProjectRequestPanel
          projects={projects}
          fontSize={fontSize}
          themeMode={themeMode}
          animation={projectAnimation}
          onEditProject={onEditProject}
          onDeleteProject={onDeleteProject}
        />
      </div>
    </div>
  );
}

// Add Entry Modal - Simple entry type selection
function AddEntryModal({
  isOpen,
  onClose,
  onAddEntry,
  onAddProject,
  onOpenDisplaySettings,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddEntry: (category: EventCategory) => void;
  onAddProject: () => void;
  onOpenDisplaySettings: () => void;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-900 border-gray-700 text-white'} max-w-md`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">SETTINGS</DialogTitle>
          <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-sm`}>Select an option</p>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Button
            className={`w-full ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' : 'bg-gray-800 hover:bg-gray-700 text-white'} h-16 justify-start text-left`}
            onClick={() => { onAddEntry('schedule'); onClose(); }}
          >
            <div className="flex items-center gap-4">
              <div className="w-4 h-10 rounded-full bg-blue-500" />
              <div>
                <p className="font-semibold text-lg">Schedule Event</p>
                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Add an event to the calendar</p>
              </div>
            </div>
          </Button>
          <Button
            className={`w-full ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' : 'bg-gray-800 hover:bg-gray-700 text-white'} h-16 justify-start text-left`}
            onClick={() => { onAddEntry('cto'); onClose(); }}
          >
            <div className="flex items-center gap-4">
              <div className="w-4 h-10 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <div>
                <p className="font-semibold text-lg">CTO Entry</p>
                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Compensatory Time Off</p>
              </div>
            </div>
          </Button>
          <Button
            className={`w-full ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' : 'bg-gray-800 hover:bg-gray-700 text-white'} h-16 justify-start text-left`}
            onClick={() => { onAddEntry('wfh'); onClose(); }}
          >
            <div className="flex items-center gap-4">
              <div className="w-4 h-10 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
              <div>
                <p className="font-semibold text-lg">WFH Entry</p>
                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Work From Home</p>
              </div>
            </div>
          </Button>
          <Button
            className={`w-full ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' : 'bg-gray-800 hover:bg-gray-700 text-white'} h-16 justify-start text-left`}
            onClick={() => { onAddEntry('travel'); onClose(); }}
          >
            <div className="flex items-center gap-4">
              <div className="w-4 h-10 rounded-full" style={{ backgroundColor: '#06b6d4' }} />
              <div>
                <p className="font-semibold text-lg">Travel Entry</p>
                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Business Travel</p>
              </div>
            </div>
          </Button>
          <Button
            className={`w-full ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' : 'bg-gray-800 hover:bg-gray-700 text-white'} h-16 justify-start text-left`}
            onClick={() => { onAddProject(); onClose(); }}
          >
            <div className="flex items-center gap-4">
              <div className="w-4 h-10 rounded-full bg-emerald-500" />
              <div>
                <p className="font-semibold text-lg">Project Request</p>
                <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Add a project request</p>
              </div>
            </div>
          </Button>
          <div className={`border-t ${isLight ? 'border-gray-200' : 'border-gray-700'} pt-3 mt-3`}>
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-16 justify-start text-left"
              onClick={() => { onOpenDisplaySettings(); onClose(); }}
            >
              <div className="flex items-center gap-4">
                <Monitor className="w-6 h-6" />
                <div>
                  <p className="font-semibold text-lg">Display Settings</p>
                  <p className="text-sm text-blue-200">Configure panel animations & transitions</p>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Display Settings Modal
function DisplaySettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Partial<Settings>) => void;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  
  // Default animation object
  const defaultAnim: PanelAnimation = { type: 'static', enabled: false, interval: 5 };
  
  // Safe getter for animation with proper fallback
  const getAnim = (anim: PanelAnimation | undefined): PanelAnimation => {
    try {
      if (anim && typeof anim === 'object' && anim.type !== undefined) {
        return {
          type: anim.type || 'static',
          enabled: typeof anim.enabled === 'boolean' ? anim.enabled : false,
          interval: typeof anim.interval === 'number' ? anim.interval : 5,
        };
      }
      return { ...defaultAnim };
    } catch {
      return { ...defaultAnim };
    }
  };
  
  const [todayAnimation, setTodayAnimation] = useState<PanelAnimation>(() => getAnim(settings?.todayAnimation));
  const [tomorrowAnimation, setTomorrowAnimation] = useState<PanelAnimation>(() => getAnim(settings?.tomorrowAnimation));
  const [todayCTOAnimation, setTodayCTOAnimation] = useState<PanelAnimation>(() => getAnim(settings?.todayCTOAnimation));
  const [todayWFHAnimation, setTodayWFHAnimation] = useState<PanelAnimation>(() => getAnim(settings?.todayWFHAnimation));
  const [todayTravelAnimation, setTodayTravelAnimation] = useState<PanelAnimation>(() => getAnim(settings?.todayTravelAnimation));
  const [tomorrowCategoryAnimation, setTomorrowCategoryAnimation] = useState<PanelAnimation>(() => getAnim(settings?.tomorrowCategoryAnimation));

  useEffect(() => {
    setTodayAnimation(getAnim(settings?.todayAnimation));
    setTomorrowAnimation(getAnim(settings?.tomorrowAnimation));
    setTodayCTOAnimation(getAnim(settings?.todayCTOAnimation));
    setTodayWFHAnimation(getAnim(settings?.todayWFHAnimation));
    setTodayTravelAnimation(getAnim(settings?.todayTravelAnimation));
    setTomorrowCategoryAnimation(getAnim(settings?.tomorrowCategoryAnimation));
  }, [settings]);

  const animationTypes: { value: AnimationType; label: string }[] = [
    { value: 'static', label: 'Static' },
    { value: 'scroll-up', label: 'Scroll Up' },
    { value: 'scroll-down', label: 'Scroll Down' },
    { value: 'fade', label: 'Fade' },
    { value: 'slide-left', label: 'Slide Left' },
    { value: 'slide-right', label: 'Slide Right' },
    { value: 'flip', label: 'Flip' },
    { value: 'bounce', label: 'Bounce' },
    { value: 'continuous-scroll-up', label: 'Continuous Roll Up' },
    { value: 'continuous-scroll-down', label: 'Continuous Roll Down' },
  ];

  const handleSave = () => {
    onSave({
      todayAnimation,
      tomorrowAnimation,
      todayCTOAnimation,
      todayWFHAnimation,
      todayTravelAnimation,
      tomorrowCategoryAnimation,
    });
    onClose();
  };

  // Animation Row Component - Compact inline version
  const AnimationRow = ({ 
    title, 
    animation, 
    setAnimation,
    color,
    isLight: rowIsLight = false
  }: { 
    title: string; 
    animation: PanelAnimation; 
    setAnimation: (a: PanelAnimation) => void;
    color: string;
    isLight?: boolean;
  }) => (
    <div className={`flex items-center gap-4 p-4 rounded-xl border ${rowIsLight ? 'bg-white border-gray-300' : 'bg-gray-800/40 border-gray-700/50'}`}>
      <div className="flex items-center gap-3 min-w-[180px]">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className={`${rowIsLight ? 'text-gray-800' : 'text-white'} font-medium`}>{title}</span>
      </div>
      
      <button
        onClick={() => setAnimation({ ...animation, enabled: !animation.enabled })}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${animation.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
      >
        <motion.div
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
          animate={{ left: animation.enabled ? '22px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      
      <Select
        value={animation.type}
        onValueChange={(value: AnimationType) => setAnimation({ ...animation, type: value })}
        disabled={!animation.enabled}
      >
        <SelectTrigger className={`w-44 h-9 ${animation.enabled ? (rowIsLight ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-gray-700/50 border-gray-600 text-white') : (rowIsLight ? 'bg-gray-200 border-gray-300 text-gray-400' : 'bg-gray-800 border-gray-700 text-gray-500')}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={`${rowIsLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'}`}>
          {animationTypes.map((type) => (
            <SelectItem key={type.value} value={type.value} className={rowIsLight ? 'hover:bg-gray-100' : 'hover:bg-gray-600'}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={60}
          value={animation.interval || 5}
          onChange={(e) => setAnimation({ ...animation, interval: parseInt(e.target.value) || 5 })}
          disabled={!animation.enabled}
          className={`w-16 h-9 text-center ${animation.enabled ? (rowIsLight ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-gray-700/50 border-gray-600 text-white') : (rowIsLight ? 'bg-gray-200 border-gray-300 text-gray-400' : 'bg-gray-800 border-gray-700 text-gray-500')}`}
        />
        <span className={`text-xs ${rowIsLight ? 'text-gray-500' : 'text-gray-400'}`}>sec</span>
      </div>
      
      <div className="ml-auto min-w-[100px]">
        {animation.enabled ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-600 text-xs">
            <Play className="w-3 h-3" />
            Active
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${rowIsLight ? 'bg-gray-200 text-gray-500' : 'bg-gray-600/30 text-gray-500'} text-xs`}>
            <Pause className="w-3 h-3" />
            Off
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent fullscreen className={`${isLight ? 'bg-gray-100 text-gray-800' : 'bg-gray-950 text-white'}`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2.5 rounded-lg ${isLight ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-800 hover:bg-gray-700'} transition-colors`}
        >
          <XIcon className={`w-5 h-5 ${isLight ? 'text-gray-600' : 'text-gray-400'}`} />
        </button>
        
        <DialogHeader className="px-8 pt-6 pb-3">
          <DialogTitle className="text-2xl font-bold">Display Settings</DialogTitle>
          <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-sm`}>Configure panel animations and transitions</p>
        </DialogHeader>
        
        <div className="flex-1 px-8 py-4">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* TODAY Section */}
            <section>
              <h4 className={`flex items-center gap-2 text-xs font-semibold ${isLight ? 'text-gray-500' : 'text-gray-500'} uppercase tracking-wider mb-3`}>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Today Panels
              </h4>
              <div className="space-y-2">
                <AnimationRow 
                  title="Today Schedule" 
                  animation={todayAnimation} 
                  setAnimation={setTodayAnimation}
                  color="#3b82f6"
                  isLight={isLight}
                />
              </div>
              {/* Category Panels - Separate Controls */}
              <div className="mt-4">
                <h5 className={`flex items-center gap-2 text-xs font-semibold ${isLight ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider mb-2`}>
                  Category Panels (CTO | WFH | TRAVEL)
                </h5>
                <div className="space-y-2">
                  <AnimationRow 
                    title="CTO Panel" 
                    animation={todayCTOAnimation} 
                    setAnimation={setTodayCTOAnimation}
                    color="#f59e0b"
                    isLight={isLight}
                  />
                  <AnimationRow 
                    title="WFH Panel" 
                    animation={todayWFHAnimation} 
                    setAnimation={setTodayWFHAnimation}
                    color="#8b5cf6"
                    isLight={isLight}
                  />
                  <AnimationRow 
                    title="Travel Panel" 
                    animation={todayTravelAnimation} 
                    setAnimation={setTodayTravelAnimation}
                    color="#06b6d4"
                    isLight={isLight}
                  />
                </div>
              </div>
            </section>

            {/* TOMORROW Section */}
            <section>
              <h4 className={`flex items-center gap-2 text-xs font-semibold ${isLight ? 'text-gray-500' : 'text-gray-500'} uppercase tracking-wider mb-3`}>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Tomorrow Panels
              </h4>
              <div className="space-y-2">
                <AnimationRow 
                  title="Tomorrow Schedule" 
                  animation={tomorrowAnimation} 
                  setAnimation={setTomorrowAnimation}
                  color="#8b5cf6"
                  isLight={isLight}
                />
              </div>
              {/* Project Request Panel - Separate Category */}
              <div className="mt-4">
                <h5 className={`flex items-center gap-2 text-xs font-semibold ${isLight ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider mb-2`}>
                  Project Request Panel
                </h5>
                <div className="space-y-2">
                  <AnimationRow 
                    title="Project Request" 
                    animation={tomorrowCategoryAnimation} 
                    setAnimation={setTomorrowCategoryAnimation}
                    color="#10b981"
                    isLight={isLight}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
        
        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-8 py-4 border-t ${isLight ? 'border-gray-300 bg-gray-100' : 'border-gray-800 bg-gray-950'}`}>
          <Button variant="outline" onClick={onClose} className={`px-6 h-10 ${isLight ? 'border-gray-300 text-gray-600 hover:text-gray-800 hover:bg-gray-200' : 'border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800'}`}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="px-8 h-10 bg-green-600 hover:bg-green-700">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Theme Settings Modal - Brightness and Eye Comfort
function ThemeSettingsModal({
  isOpen,
  onClose,
  theme,
  onSave,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeSettings;
  onSave: (theme: Partial<ThemeSettings>) => void;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  const [localTheme, setLocalTheme] = useState<ThemeSettings>(theme);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  const handleSave = () => {
    onSave(localTheme);
    onClose();
  };

  const updateTheme = (key: keyof ThemeSettings, value: string | number | boolean) => {
    setLocalTheme(prev => ({ ...prev, [key]: value }));
  };

  const fontSizeOptions: { value: ThemeSettings['fontSize']; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Large' },
    { value: 'extra-large', label: 'Extra Large' },
  ];

  const modeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'dark', label: 'Dark Mode', icon: <Moon className="w-4 h-4" /> },
    { value: 'light', label: 'Light Mode', icon: <Sun className="w-4 h-4" /> },
    { value: 'auto', label: 'Auto (System)', icon: <SunMoon className="w-4 h-4" /> },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-900 border-gray-700 text-white'} max-w-lg w-full mx-auto max-h-[90vh] overflow-y-auto`}>
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Eye className="w-6 h-6 text-blue-400" />
            Theme & Eye Comfort
          </DialogTitle>
          <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-sm`}>Adjust display for better visibility and comfort</p>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Theme Mode Selection */}
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-2`}>
              <SunMoon className="w-4 h-4" />
              Theme Mode
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateTheme('mode', option.value)}
                  className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all ${
                    localTheme.mode === option.value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : `${isLight ? 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`
                  }`}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brightness Slider */}
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-2`}>
              <Sun className="w-4 h-4" />
              Brightness: {localTheme.brightness}%
            </Label>
            <div className="flex items-center gap-3">
              <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-500'} w-8`}>50%</span>
              <input
                type="range"
                min="50"
                max="150"
                value={localTheme.brightness}
                onChange={(e) => updateTheme('brightness', parseInt(e.target.value))}
                className={`flex-1 h-2 ${isLight ? 'bg-gray-300' : 'bg-gray-700'} rounded-lg appearance-none cursor-pointer accent-blue-500`}
              />
              <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-500'} w-8`}>150%</span>
            </div>
          </div>

          {/* Contrast Slider */}
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-2`}>
              <Sliders className="w-4 h-4" />
              Contrast: {localTheme.contrast}%
            </Label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-8">50%</span>
              <input
                type="range"
                min="50"
                max="150"
                value={localTheme.contrast}
                onChange={(e) => updateTheme('contrast', parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <span className="text-xs text-gray-500 w-8">150%</span>
            </div>
          </div>

          {/* Saturation Slider */}
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-2`}>
              <Sparkles className="w-4 h-4" />
              Saturation: {localTheme.saturation}%
            </Label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-8">50%</span>
              <input
                type="range"
                min="50"
                max="150"
                value={localTheme.saturation}
                onChange={(e) => updateTheme('saturation', parseInt(e.target.value))}
                className={`flex-1 h-2 ${isLight ? 'bg-gray-300' : 'bg-gray-700'} rounded-lg appearance-none cursor-pointer accent-green-500`}
              />
              <span className="text-xs text-gray-500 w-8">150%</span>
            </div>
          </div>

          {/* Blue Light Filter */}
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} flex items-center gap-2 mb-2`}>
              <Eye className="w-4 h-4" />
              Blue Light Filter: {localTheme.blueLightFilter}%
            </Label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-8">0%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={localTheme.blueLightFilter}
                onChange={(e) => updateTheme('blueLightFilter', parseInt(e.target.value))}
                className={`flex-1 h-2 ${isLight ? 'bg-gray-300' : 'bg-gray-700'} rounded-lg appearance-none cursor-pointer accent-amber-500`}
              />
              <span className="text-xs text-gray-500 w-8">100%</span>
            </div>
          </div>

          {/* Font Size */}
          <div>
            <Label className={`${isLight ? 'text-gray-700' : 'text-gray-300'} mb-2 block`}>Font Size</Label>
            <Select
              value={localTheme.fontSize}
              onValueChange={(value: ThemeSettings['fontSize']) => updateTheme('fontSize', value)}
            >
              <SelectTrigger className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-800 border-gray-600 text-white'}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`${isLight ? 'bg-white border-gray-300 text-gray-800' : 'bg-gray-700 border-gray-600 text-white'}`}>
                {fontSizeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className={isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-600'}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reduce Motion Toggle */}
          <div className={`flex items-center justify-between p-3 ${isLight ? 'bg-gray-100 border-gray-300' : 'bg-gray-800/50 border-gray-700'} rounded-lg border`}>
            <Label className={isLight ? 'text-gray-700' : 'text-gray-300'}>Reduce Motion</Label>
            <button
              onClick={() => updateTheme('reduceMotion', !localTheme.reduceMotion)}
              className={`relative w-11 h-6 rounded-full transition-colors ${localTheme.reduceMotion ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: localTheme.reduceMotion ? '26px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        <DialogFooter className="flex justify-center gap-3">
          <Button variant="ghost" onClick={onClose} className={`${isLight ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400'} px-6`}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-8">Apply Theme</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Calendar Modal with Day, Week, Month views
function CalendarModal({
  isOpen,
  onClose,
  events,
  colors,
  onEditEvent,
  onDeleteEvent,
  onCancelEvent,
  onAddEvent,
  themeMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  colors: Settings['colors'];
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onCancelEvent: (id: string) => void;
  onAddEvent: (date: Date) => void;
  themeMode?: ThemeMode;
}) {
  const isLight = themeMode === 'light';
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const navigatePrevious = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, -1));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getEventsForDate = (date: Date) => events.filter((e) => isSameDay(new Date(e.date), date));

  const getTitle = () => {
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

  // Day View
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`text-center py-5 border-b ${isLight ? 'border-gray-300 bg-gray-100' : 'border-gray-700 bg-gray-800/30'}`}>
          <p className={`text-3xl font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>{format(currentDate, 'EEEE')}</p>
          <p className={`text-xl ${isLight ? 'text-gray-600' : 'text-gray-400'} mt-1`}>{format(currentDate, 'MMMM d, yyyy')}</p>
        </div>
        <ScrollArea className="flex-1">
          {hours.map((hour) => {
            const hourEvents = dayEvents.filter((e) => parseInt(e.time.split(':')[0]) === hour);
            return (
              <div key={hour} className={`flex border-b ${isLight ? 'border-gray-200' : 'border-gray-800'} min-h-[70px]`}>
                <div className={`w-20 text-right pr-4 py-2 ${isLight ? 'text-gray-500' : 'text-gray-500'} text-sm font-medium`}>{format(new Date().setHours(hour, 0), 'h a')}</div>
                <div className="flex-1 p-2">
                  {hourEvents.map((event) => {
                    const isCancelled = event.status === 'cancelled';
                    return (
                      <div 
                        key={event.id} 
                        className={`mb-2 p-3 rounded-lg cursor-pointer transition-colors ${isCancelled ? (isLight ? 'bg-gray-200/50' : 'bg-gray-800/50') : (isLight ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-800 hover:bg-gray-700')}`} 
                        onClick={() => onEditEvent(event)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: getStatusColor(event.status, colors) }} />
                          <p className={`text-lg font-semibold ${isCancelled ? 'text-gray-500 line-through' : (isLight ? 'text-gray-800' : 'text-white')}`}>{event.title}</p>
                          <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{formatTimeRange(event.time, event.timeEnd)}</p>
                          {event.location && <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>📍 {event.location}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </ScrollArea>
        <div className={`p-4 border-t ${isLight ? 'border-gray-300 bg-gray-100' : 'border-gray-700 bg-gray-800/30'}`}>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg" onClick={() => onAddEvent(currentDate)}>Add Event for {format(currentDate, 'MMM d')}</Button>
        </div>
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`grid grid-cols-8 border-b ${isLight ? 'border-gray-300 bg-gray-100' : 'border-gray-700 bg-gray-800/30'}`}>
          <div className="p-3"></div>
          {weekDays.map((day) => (
            <div key={day.toISOString()} className={`p-3 text-center border-l ${isLight ? 'border-gray-300' : 'border-gray-700'} ${isToday(day) ? 'bg-blue-600/20' : ''}`}>
              <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'} uppercase font-medium`}>{format(day, 'EEE')}</p>
              <p className={`text-2xl font-bold ${isToday(day) ? 'text-blue-500' : isLight ? 'text-gray-800' : 'text-white'}`}>{format(day, 'd')}</p>
            </div>
          ))}
        </div>
        <ScrollArea className="flex-1">
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className={`grid grid-cols-8 border-b ${isLight ? 'border-gray-200' : 'border-gray-800'} min-h-[60px]`}>
              <div className={`text-right pr-3 py-2 ${isLight ? 'text-gray-500' : 'text-gray-500'} text-sm font-medium`}>{format(new Date().setHours(hour, 0), 'h a')}</div>
              {weekDays.map((day) => {
                const dayEvents = getEventsForDate(day).filter((e) => parseInt(e.time.split(':')[0]) === hour);
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`border-l p-1 cursor-pointer ${isLight ? 'border-gray-200 hover:bg-gray-100' : 'border-gray-800 hover:bg-gray-800/50'} ${isToday(day) ? 'bg-blue-600/10' : ''}`} 
                    onClick={() => onAddEvent(day)}
                  >
                    {dayEvents.map((event) => (
                      <div 
                        key={event.id} 
                        className={`mb-1 p-2 rounded text-sm truncate ${isLight ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-gray-700 text-white hover:bg-gray-600'}`} 
                        style={{ borderLeft: `3px solid ${getStatusColor(event.status, colors)}` }} 
                        onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                      >
                        <p className="font-medium">{event.title}</p>
                        <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{formatTimeRange(event.time, event.timeEnd)}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </ScrollArea>
      </div>
    );
  };

  // Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day headers */}
        <div className={`grid grid-cols-7 border-b ${isLight ? 'border-gray-300 bg-gray-100' : 'border-gray-700 bg-gray-800/30'}`}>
          {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((day) => (
            <div key={day} className={`p-3 text-center ${isLight ? 'text-gray-600' : 'text-gray-300'} text-sm font-bold border-r ${isLight ? 'border-gray-300' : 'border-gray-700'} last:border-r-0`}>{day}</div>
          ))}
        </div>
        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <div 
                key={day.toISOString()} 
                className={`border-r border-b p-2 cursor-pointer transition-colors ${isLight ? 'border-gray-300' : 'border-gray-700'} ${!isCurrentMonth ? (isLight ? 'bg-gray-100' : 'bg-gray-900/50') : (isLight ? 'bg-white' : 'bg-gray-900/20')} ${isToday(day) ? 'bg-blue-600/20' : ''} ${isSelected ? 'bg-blue-600/30 ring-1 ring-blue-500' : ''} ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800/50'}`} 
                onClick={() => setSelectedDate(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-base font-bold ${!isCurrentMonth ? (isLight ? 'text-gray-400' : 'text-gray-600') : isToday(day) ? 'text-blue-500' : (isLight ? 'text-gray-800' : 'text-white')}`}>{format(day, 'd')}</span>
                  {isToday(day) && <span className="text-xs text-blue-500 font-medium">TODAY</span>}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const isCancelled = event.status === 'cancelled';
                    return (
                      <div 
                        key={event.id} 
                        className={`text-sm p-1.5 rounded truncate ${isCancelled ? 'text-gray-500 line-through bg-gray-800/50' : (isLight ? 'text-gray-800' : 'text-white')} hover:opacity-80`} 
                        style={{ backgroundColor: isCancelled ? undefined : `${getStatusColor(event.status, colors)}50`, borderLeft: `3px solid ${getStatusColor(event.status, colors)}` }} 
                        onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                      >
                        <span className="font-medium">{event.title}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && <div className={`text-xs px-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>+{dayEvents.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Selected Date Events Panel */}
        {selectedDate && (
          <div className={`border-t p-4 ${isLight ? 'border-gray-300 bg-gray-100' : 'border-gray-700 bg-gray-800/80'}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h4>
              <Button className="bg-blue-600 hover:bg-blue-700 h-10 px-4" onClick={() => onAddEvent(selectedDate)}>Add Event</Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {getEventsForDate(selectedDate).length === 0 ? (
                <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-base`}>No events scheduled for this day</p>
              ) : (
                getEventsForDate(selectedDate).map((event) => (
                  <div 
                    key={event.id} 
                    className={`flex-shrink-0 w-52 p-3 rounded-lg cursor-pointer transition-colors ${isLight ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-700 hover:bg-gray-600'}`} 
                    onClick={() => onEditEvent(event)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-10 rounded-full" style={{ backgroundColor: getStatusColor(event.status, colors) }} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${isLight ? 'text-gray-800' : 'text-white'}`}>{event.title}</p>
                        <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{formatTimeRange(event.time, event.timeEnd)}</p>
                        {event.location && <p className="text-xs text-gray-500 truncate">📍 {event.location}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent fullscreen showCloseButton={false} className={isLight ? 'bg-gray-50 text-gray-800' : 'bg-gray-900 text-white'}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${isLight ? 'border-gray-300 bg-white' : 'border-gray-700 bg-gray-800/50'}`}>
          <div className="flex items-center gap-4">
            <h2 className={`text-2xl font-bold tracking-widest ${isLight ? 'text-gray-800' : 'text-white'}`}>CALENDAR</h2>
            <div className={`flex rounded-lg p-1 ${isLight ? 'bg-gray-200' : 'bg-gray-800'}`}>
              {(['day', 'week', 'month'] as const).map((mode) => (
                <Button key={mode} variant={viewMode === mode ? 'default' : 'ghost'} size="sm" className={`px-5 h-10 ${viewMode === mode ? 'bg-blue-600 text-white' : isLight ? 'text-gray-600' : 'text-gray-400'}`} onClick={() => setViewMode(mode)}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className={`h-10 px-4 ${isLight ? 'bg-white border-gray-300 text-gray-700' : 'bg-gray-800 border-gray-600 text-white'}`}>Today</Button>
            <Button variant="ghost" size="icon" onClick={navigatePrevious} className={`h-10 w-10 ${isLight ? 'text-gray-600 hover:text-gray-800' : 'text-gray-400 hover:text-white'}`}><ChevronLeft className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" onClick={navigateNext} className={`h-10 w-10 ${isLight ? 'text-gray-600 hover:text-gray-800' : 'text-gray-400 hover:text-white'}`}><ChevronRight className="w-5 h-5" /></Button>
            <h3 className={`text-xl font-semibold min-w-[220px] text-center ${isLight ? 'text-gray-800' : 'text-white'}`}>{getTitle()}</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className={`h-10 w-10 ml-4 ${isLight ? 'text-gray-600 hover:text-gray-800' : 'text-gray-400 hover:text-white'}`}><XCircle className="w-5 h-5" /></Button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export default function PCIEERDCalendarSystem() {
  const { events, settings, isLoading, setEvents, addEvent, updateEvent, deleteEvent, setIsLoading, setSettings } = useCalendarStore();

  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [addEntryModalOpen, setAddEntryModalOpen] = useState(false);
  const [displaySettingsModalOpen, setDisplaySettingsModalOpen] = useState(false);
  const [themeSettingsModalOpen, setThemeSettingsModalOpen] = useState(false);

  // Separate modals for different entry types
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [ctoModalOpen, setCTOModalOpen] = useState(false);
  const [wfhModalOpen, setWFHModalOpen] = useState(false);
  const [travelModalOpen, setTravelModalOpen] = useState(false);

  // Project Request state
  const [projectRequests, setProjectRequests] = useState<ProjectRequestItem[]>([]);
  const [projectRequestModalOpen, setProjectRequestModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRequestItem | null>(null);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date>(new Date());

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'event' | 'project'; id: string; name: string } | null>(null);

  // Notification state
  const [activeNotification, setActiveNotification] = useState<CalendarEvent | null>(null);
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, projectsRes, settingsRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/project-requests'),
        fetch('/api/settings'),
      ]);
      const eventsData = await eventsRes.json();
      const projectsData = await projectsRes.json();
      const settingsData = await settingsRes.json();
      
      setEvents(eventsData.map((e: CalendarEvent) => ({ ...e, date: new Date(e.date), createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) })));
      setProjectRequests(projectsData.map((p: ProjectRequestItem) => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })));
      
      // Load settings from database if available
      if (settingsData.settings) {
        // Migrate old settings format to new format
        const loadedSettings = settingsData.settings as Record<string, unknown>;
        const defaultAnimation: PanelAnimation = { type: 'static', enabled: false, interval: 5 };
        
        // If old todayCategoryAnimation exists but new fields don't, migrate
        if (loadedSettings.todayCategoryAnimation && !loadedSettings.todayCTOAnimation) {
          loadedSettings.todayCTOAnimation = loadedSettings.todayCategoryAnimation;
          loadedSettings.todayWFHAnimation = loadedSettings.todayCategoryAnimation;
          loadedSettings.todayTravelAnimation = loadedSettings.todayCategoryAnimation;
        }
        
        // Ensure all animation fields exist with defaults
        loadedSettings.todayAnimation = loadedSettings.todayAnimation || defaultAnimation;
        loadedSettings.tomorrowAnimation = loadedSettings.tomorrowAnimation || defaultAnimation;
        loadedSettings.todayCTOAnimation = loadedSettings.todayCTOAnimation || defaultAnimation;
        loadedSettings.todayWFHAnimation = loadedSettings.todayWFHAnimation || defaultAnimation;
        loadedSettings.todayTravelAnimation = loadedSettings.todayTravelAnimation || defaultAnimation;
        loadedSettings.tomorrowCategoryAnimation = loadedSettings.tomorrowCategoryAnimation || defaultAnimation;
        
        setSettings(loadedSettings as unknown as Partial<Settings>);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setEvents, setIsLoading, setSettings]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const interval = setInterval(fetchData, 30000); return () => clearInterval(interval); }, [fetchData]);

  // Check if any settings-related modal is open (to prevent settings override while editing)
  const isSettingsModalOpen = displaySettingsModalOpen || themeSettingsModalOpen || addEntryModalOpen;

  // Faster settings refresh (every 5 seconds) for TV display sync
  // Skip if a settings modal is open to prevent overriding user changes
  useEffect(() => {
    // Don't poll settings while user is editing in a modal
    if (isSettingsModalOpen) return;

    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    const interval = setInterval(fetchSettings, 5000);
    return () => clearInterval(interval);
  }, [setSettings, isSettingsModalOpen]);

  // Real-time settings sync using BroadcastChannel
  // Skip if a settings modal is open to prevent overriding user changes
  useEffect(() => {
    if (isSettingsModalOpen) return;

    const channel = new BroadcastChannel('eustdd-calendar-settings');

    // Listen for settings changes from other tabs/windows
    channel.onmessage = (event) => {
      if (event.data.type === 'settings-updated') {
        setSettings(event.data.settings);
      }
    };

    return () => channel.close();
  }, [setSettings, isSettingsModalOpen]);

  // Save settings to database when they change
  const saveSettingsToDb = useCallback(async (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings }),
      });
      
      // Broadcast settings change to other tabs/windows
      const channel = new BroadcastChannel('eustdd-calendar-settings');
      channel.postMessage({ type: 'settings-updated', settings: updatedSettings });
      channel.close();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [settings]);

  // Wrapper for setSettings that also saves to database
  const handleSetSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(newSettings);
    saveSettingsToDb(newSettings);
  }, [setSettings, saveSettingsToDb]);

  // Check for events that are starting and show notification
  useEffect(() => {
    const checkUpcomingEvents = () => {
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      const currentDateStr = format(now, 'yyyy-MM-dd');

      // Find events that should start now (within 1 minute window)
      const startingEvents = events.filter((event) => {
        if (event.status === 'cancelled') return false;
        
        const eventDateStr = format(new Date(event.date), 'yyyy-MM-dd');
        if (eventDateStr !== currentDateStr) return false;

        const [eventHour, eventMinute] = event.time.split(':').map(Number);
        const [currentHour, currentMinute] = currentTime.split(':').map(Number);
        
        const eventTimeInMinutes = eventHour * 60 + eventMinute;
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        // Check if event starts within 1 minute (before or after current time)
        const timeDiff = eventTimeInMinutes - currentTimeInMinutes;
        return timeDiff >= -1 && timeDiff <= 1;
      });

      // Show notification for events that haven't been notified yet
      for (const event of startingEvents) {
        if (!notifiedEventsRef.current.has(event.id)) {
          notifiedEventsRef.current.add(event.id);
          
          // Play notification sound
          playNotificationSound();
          
          // Show notification bar
          setActiveNotification(event);
          
          // Update event status to 'ongoing'
          updateEventStatus(event.id, 'ongoing');
          
          // Auto-dismiss after 10 seconds
          setTimeout(() => {
            setActiveNotification((current) => 
              current?.id === event.id ? null : current
            );
          }, 10000);
          
          break; // Only show one notification at a time
        }
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkUpcomingEvents, 30000);
    checkUpcomingEvents(); // Initial check

    return () => clearInterval(interval);
  }, [events]);

  // Update event status via API
  const updateEventStatus = async (id: string, status: EventStatus) => {
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const updatedEvent = await response.json();
      updateEvent(id, { ...updatedEvent, date: new Date(updatedEvent.date) });
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  const openModalForCategory = (category: EventCategory, date?: Date) => {
    setEditingEvent(null);
    setDefaultDate(date || new Date());
    if (category === 'schedule') setScheduleModalOpen(true);
    else if (category === 'cto') setCTOModalOpen(true);
    else if (category === 'wfh') setWFHModalOpen(true);
    else if (category === 'travel') setTravelModalOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDefaultDate(new Date(event.date));
    if (event.category === 'schedule') setScheduleModalOpen(true);
    else if (event.category === 'cto') setCTOModalOpen(true);
    else if (event.category === 'wfh') setWFHModalOpen(true);
    else if (event.category === 'travel') setTravelModalOpen(true);
  };

  // Request delete confirmation
  const requestDeleteEvent = (id: string) => {
    const event = events.find(e => e.id === id);
    setDeleteTarget({ type: 'event', id, name: event?.title || 'this entry' });
    setDeleteConfirmOpen(true);
  };

  const requestDeleteProject = (id: string) => {
    const project = projectRequests.find(p => p.id === id);
    setDeleteTarget({ type: 'project', id, name: project?.name || 'this project' });
    setDeleteConfirmOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      if (deleteTarget.type === 'event') {
        await fetch(`/api/events/${deleteTarget.id}`, { method: 'DELETE' });
        deleteEvent(deleteTarget.id);
      } else {
        await fetch(`/api/project-requests/${deleteTarget.id}`, { method: 'DELETE' });
        setProjectRequests(prev => prev.filter(p => p.id !== deleteTarget.id));
      }
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try { await fetch(`/api/events/${id}`, { method: 'DELETE' }); deleteEvent(id); } catch (error) { console.error('Error deleting event:', error); }
  };

  const handleCancelEvent = async (id: string) => {
    try {
      const response = await fetch(`/api/events/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) });
      const updatedEvent = await response.json();
      updateEvent(id, { ...updatedEvent, date: new Date(updatedEvent.date) });
    } catch (error) { console.error('Error cancelling event:', error); }
  };

  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    try {
      if (editingEvent?.id) {
        const response = await fetch(`/api/events/${editingEvent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventData) });
        const updatedEvent = await response.json();
        updateEvent(editingEvent.id, { ...updatedEvent, date: new Date(updatedEvent.date) });
      } else {
        const response = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventData) });
        const newEvent = await response.json();
        addEvent({ ...newEvent, date: new Date(newEvent.date) });
      }
    } catch (error) { console.error('Error saving event:', error); }
  };

  // Project Request handlers
  const handleAddProject = () => {
    setEditingProject(null);
    setProjectRequestModalOpen(true);
  };

  const handleEditProject = (project: ProjectRequestItem) => {
    setEditingProject(project);
    setProjectRequestModalOpen(true);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await fetch(`/api/project-requests/${id}`, { method: 'DELETE' });
      setProjectRequests(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting project request:', error);
    }
  };

  const handleSaveProject = async (projectData: Partial<ProjectRequestItem>) => {
    try {
      if (editingProject?.id) {
        const response = await fetch(`/api/project-requests/${editingProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData),
        });
        const updatedProject = await response.json();
        setProjectRequests(prev => prev.map(p => p.id === editingProject.id ? { ...updatedProject, createdAt: new Date(updatedProject.createdAt), updatedAt: new Date(updatedProject.updatedAt) } : p));
      } else {
        const response = await fetch('/api/project-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData),
        });
        const newProject = await response.json();
        setProjectRequests(prev => [...prev, { ...newProject, createdAt: new Date(newProject.createdAt), updatedAt: new Date(newProject.updatedAt) }]);
      }
    } catch (error) {
      console.error('Error saving project request:', error);
    }
  };

  const today = new Date();
  const tomorrow = addDays(new Date(), 1);

  // Sort events by time (chronological order)
  const sortByTime = (a: CalendarEvent, b: CalendarEvent) => {
    const [aHour, aMinute] = a.time.split(':').map(Number);
    const [bHour, bMinute] = b.time.split(':').map(Number);
    return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
  };

  const todayEvents = events
    .filter((e) => e.category === 'schedule' && format(new Date(e.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
    .sort(sortByTime);
  const tomorrowEvents = events
    .filter((e) => e.category === 'schedule' && format(new Date(e.date), 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd'))
    .sort(sortByTime);

  const todayCTO = events.filter((e) => e.category === 'cto' && format(new Date(e.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')).sort(sortByTime);
  const todayWFH = events.filter((e) => e.category === 'wfh' && format(new Date(e.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')).sort(sortByTime);
  const todayTravel = events.filter((e) => e.category === 'travel' && format(new Date(e.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')).sort(sortByTime);

  const tomorrowCTO = events.filter((e) => e.category === 'cto' && format(new Date(e.date), 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')).sort(sortByTime);
  const tomorrowWFH = events.filter((e) => e.category === 'wfh' && format(new Date(e.date), 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')).sort(sortByTime);
  const tomorrowTravel = events.filter((e) => e.category === 'travel' && format(new Date(e.date), 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')).sort(sortByTime);

  if (isLoading) {
    const bgColor = settings.theme.mode === 'light' ? '#f3f4f6' : '#030712';
    const textColor = settings.theme.mode === 'light' ? '#1f2937' : '#ffffff';
    return <div className="h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}><div className="flex items-center gap-3" style={{ color: textColor }}><RefreshCw className="w-8 h-8 animate-spin" /><span className="text-xl">Loading...</span></div></div>;
  }

  // Get theme styles including custom colors
  const getThemeStyles = () => {
    const { theme } = settings;
    const isLight = theme.mode === 'light';
    const isAuto = theme.mode === 'auto';
    // For auto mode, we could detect system preference, but default to dark for now
    const effectiveMode = isAuto ? 'dark' : theme.mode;

    // Default colors based on mode
    const defaultBg = isLight ? '#f3f4f6' : '#030712';
    const defaultCardBg = isLight ? '#ffffff' : '#111827';
    const defaultTextPrimary = isLight ? '#1f2937' : '#ffffff';
    const defaultTextSecondary = isLight ? '#6b7280' : '#9ca3af';

    return {
      filter: `brightness(${theme.brightness}%) contrast(${theme.contrast}%) saturate(${theme.saturation}%)${theme.blueLightFilter > 0 ? ` sepia(${theme.blueLightFilter * 0.3}%)` : ''}`,
      backgroundColor: theme.backgroundColor || defaultBg,
      color: theme.primaryTextColor || defaultTextPrimary,
      cardBg: theme.cardBackgroundColor || defaultCardBg,
      textSecondary: theme.secondaryTextColor || defaultTextSecondary,
    };
  };

  // Get CSS variables for custom colors
  const getCustomColorVars = () => {
    const { theme } = settings;
    const isLight = theme.mode === 'light';
    const defaultBg = isLight ? '#f3f4f6' : '#030712';
    const defaultCardBg = isLight ? '#ffffff' : '#111827';
    const defaultTextPrimary = isLight ? '#1f2937' : '#ffffff';
    const defaultTextSecondary = isLight ? '#6b7280' : '#9ca3af';

    return {
      '--bg-color': theme.backgroundColor || defaultBg,
      '--card-bg': theme.cardBackgroundColor || defaultCardBg,
      '--text-primary': theme.primaryTextColor || defaultTextPrimary,
      '--text-secondary': theme.secondaryTextColor || defaultTextSecondary,
      '--accent-color': theme.accentColor || '#3b82f6',
    } as React.CSSProperties;
  };

  const getFontSizeClass = () => {
    switch (settings.theme.fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      case 'extra-large': return 'text-xl';
      default: return 'text-base';
    }
  };

  const theme = settings.theme;
  const themeStyles = getThemeStyles();
  const isLightMode = theme.mode === 'light';

  return (
    <div 
      className={`h-screen flex flex-col overflow-hidden transition-colors duration-300 ${isLightMode ? 'bg-gray-100' : 'bg-gray-950'}`}
      style={{ ...getCustomColorVars(), filter: themeStyles.filter }}
    >
      {/* Notification Bar */}
      <AnimatePresence>
        {activeNotification && (
          <NotificationBar event={activeNotification} />
        )}
      </AnimatePresence>

      {/* Header */}
      <header 
        className={`border-b px-6 py-4 flex-shrink-0 ${isLightMode ? 'bg-white border-gray-300' : 'border-gray-800'}`}
        style={{ backgroundColor: isLightMode ? undefined : (theme.cardBackgroundColor || '#111827'), borderColor: isLightMode ? undefined : (theme.secondaryTextColor + '40' || '#374151') }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-bold tracking-widest"
              style={{ color: isLightMode ? '#1f2937' : (theme.primaryTextColor || '#ffffff') }}
            >
              EUSTDD CALENDAR
            </h1>
            <div className="flex items-center gap-4">
              <p 
                className="text-base mt-0.5"
                style={{ color: isLightMode ? '#6b7280' : (theme.secondaryTextColor || '#9ca3af') }}
              >
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
              <span 
                className="flex items-center gap-1 text-sm"
                style={{ color: isLightMode ? '#6b7280' : (theme.secondaryTextColor || '#9ca3af') }}
              >
                <Clock className="w-4 h-4" />
                {format(new Date(), 'h:mm a')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setThemeSettingsModalOpen(true)} 
              className={`h-10 w-10 relative ${isLightMode ? 'text-gray-600 hover:bg-gray-100' : ''}`} 
              style={{ color: isLightMode ? undefined : (theme.secondaryTextColor || '#9ca3af') }}
              title="Theme & Eye Comfort"
            >
              {theme.mode === 'light' ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-blue-400" />
              )}
              {theme.blueLightFilter > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setAddEntryModalOpen(true)} className={`${theme.mode === 'light' ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-300 hover:text-white hover:bg-white/10'} h-10 w-10`} title="Settings">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCalendarModalOpen(true)} className={`${theme.mode === 'light' ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-300 hover:text-white hover:bg-white/10'} h-10 w-10`} title="Calendar">
              <CalendarIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Two Columns */}
      <main className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Today Column */}
          <SchedulePanel
            title="TODAY'S SCHEDULE"
            events={todayEvents}
            colors={settings.colors}
            animation={settings.todayAnimation}
            ctoAnimation={settings.todayCTOAnimation || { type: 'static', enabled: false, interval: 5 }}
            wfhAnimation={settings.todayWFHAnimation || { type: 'static', enabled: false, interval: 5 }}
            travelAnimation={settings.todayTravelAnimation || { type: 'static', enabled: false, interval: 5 }}
            ctoEvents={todayCTO}
            wfhEvents={todayWFH}
            travelEvents={todayTravel}
            fontSize={settings.theme.fontSize}
            themeMode={settings.theme.mode}
            onEditEvent={handleEditEvent}
            onDeleteEvent={requestDeleteEvent}
            onCancelEvent={handleCancelEvent}
          />

          {/* Tomorrow Column - with PROJECT REQUEST instead of CTO-WFH-TRAVEL */}
          <TomorrowPanel
            title="TOMORROW'S SCHEDULE"
            events={tomorrowEvents}
            colors={settings.colors}
            animation={settings.tomorrowAnimation}
            projectAnimation={settings.tomorrowCategoryAnimation}
            projects={projectRequests}
            fontSize={settings.theme.fontSize}
            themeMode={settings.theme.mode}
            onEditEvent={handleEditEvent}
            onDeleteEvent={requestDeleteEvent}
            onCancelEvent={handleCancelEvent}
            onEditProject={handleEditProject}
            onDeleteProject={requestDeleteProject}
          />
        </div>
      </main>

      {/* Modals */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => { setScheduleModalOpen(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        onDelete={() => { if (editingEvent) requestDeleteEvent(editingEvent.id); setScheduleModalOpen(false); }}
        event={editingEvent?.category === 'schedule' ? editingEvent : null}
        defaultDate={defaultDate}
        themeMode={settings.theme.mode}
      />

      <CTOWFHModal
        isOpen={ctoModalOpen}
        onClose={() => { setCTOModalOpen(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        onDelete={() => { if (editingEvent) requestDeleteEvent(editingEvent.id); setCTOModalOpen(false); }}
        event={editingEvent?.category === 'cto' ? editingEvent : null}
        entryType="cto"
        defaultDate={defaultDate}
        themeMode={settings.theme.mode}
      />

      <CTOWFHModal
        isOpen={wfhModalOpen}
        onClose={() => { setWFHModalOpen(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        onDelete={() => { if (editingEvent) requestDeleteEvent(editingEvent.id); setWFHModalOpen(false); }}
        event={editingEvent?.category === 'wfh' ? editingEvent : null}
        entryType="wfh"
        defaultDate={defaultDate}
        themeMode={settings.theme.mode}
      />

      <TravelModal
        isOpen={travelModalOpen}
        onClose={() => { setTravelModalOpen(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        onDelete={() => { if (editingEvent) requestDeleteEvent(editingEvent.id); setTravelModalOpen(false); }}
        event={editingEvent?.category === 'travel' ? editingEvent : null}
        defaultDate={defaultDate}
        themeMode={settings.theme.mode}
      />

      <AddEntryModal
        isOpen={addEntryModalOpen}
        onClose={() => setAddEntryModalOpen(false)}
        onAddEntry={openModalForCategory}
        onAddProject={handleAddProject}
        onOpenDisplaySettings={() => setDisplaySettingsModalOpen(true)}
        themeMode={settings.theme.mode}
      />

      <DisplaySettingsModal
        isOpen={displaySettingsModalOpen}
        onClose={() => setDisplaySettingsModalOpen(false)}
        settings={settings}
        onSave={handleSetSettings}
        themeMode={settings.theme.mode}
      />

      <ThemeSettingsModal
        isOpen={themeSettingsModalOpen}
        onClose={() => setThemeSettingsModalOpen(false)}
        theme={settings.theme}
        onSave={(themeUpdate) => handleSetSettings({ theme: { ...settings.theme, ...themeUpdate } })}
        themeMode={settings.theme.mode}
      />

      <CalendarModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        events={events}
        colors={settings.colors}
        onEditEvent={handleEditEvent}
        onDeleteEvent={requestDeleteEvent}
        onCancelEvent={handleCancelEvent}
        onAddEvent={(date) => openModalForCategory('schedule', date)}
        themeMode={settings.theme.mode}
      />

      <ProjectRequestModal
        isOpen={projectRequestModalOpen}
        onClose={() => { setProjectRequestModalOpen(false); setEditingProject(null); }}
        onSave={handleSaveProject}
        onDelete={() => { if (editingProject) requestDeleteProject(editingProject.id); setProjectRequestModalOpen(false); }}
        project={editingProject}
        themeMode={settings.theme.mode}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        itemName={deleteTarget?.name || 'this item'}
        themeMode={settings.theme.mode}
      />
    </div>
  );
}
