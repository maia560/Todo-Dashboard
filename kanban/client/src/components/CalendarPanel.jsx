import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';

function getDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function CalendarPanel({ isOpen }) {
  const timelineRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const today = new Date();
  const todayStr = getDateStr(today);
  const selectedStr = getDateStr(selectedDate);
  const isToday = selectedStr === todayStr;

  // How many days ahead from today (0 = today, max 4 = 5 days total)
  const dayOffset = Math.round((selectedDate - new Date(todayStr)) / 86400000);
  const canGoBack = dayOffset > 0;
  const canGoForward = dayOffset < 4;

  const goBack = () => {
    if (canGoBack) setSelectedDate(addDays(selectedDate, -1));
  };
  const goForward = () => {
    if (canGoForward) setSelectedDate(addDays(selectedDate, 1));
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const dayStart = `${selectedStr}T00:00:00`;
    const dayEnd = `${selectedStr}T23:59:59`;

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time');

    if (!error && data) {
      setEvents(
        data.map((e) => ({
          id: e.id,
          subject: e.subject,
          start: e.start_time,
          end: e.end_time,
          location: e.location,
          organizer: e.organizer,
          isOrganizer: e.is_organizer,
        }))
      );
    }
    setLoading(false);
  }, [selectedStr]);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel(`calendar-realtime-${selectedStr}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedStr, fetchEvents]);

  const START_HOUR = 8;
  const END_HOUR = 17;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const HOUR_HEIGHT = 64;
  const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

  const dayEvents = events.filter((e) => {
    const s = new Date(e.start);
    return getDateStr(s) === selectedStr;
  });

  function timeToOffset(isoStr) {
    const d = new Date(isoStr);
    const hours = d.getHours() + d.getMinutes() / 60;
    const clamped = Math.max(START_HOUR, Math.min(END_HOUR, hours));
    return ((clamped - START_HOUR) / TOTAL_HOURS) * TOTAL_HEIGHT;
  }

  function eventHeight(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const startH = Math.max(START_HOUR, s.getHours() + s.getMinutes() / 60);
    const endH = Math.min(END_HOUR, e.getHours() + e.getMinutes() / 60);
    return Math.max(20, ((endH - startH) / TOTAL_HOURS) * TOTAL_HEIGHT);
  }

  function formatTime(isoStr) {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function isNow(start, end) {
    if (!isToday) return false;
    const now = new Date();
    return now >= new Date(start) && now <= new Date(end);
  }

  const [nowOffset, setNowOffset] = useState(null);
  useEffect(() => {
    function updateNow() {
      if (!isToday) {
        setNowOffset(null);
        return;
      }
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      if (hours >= START_HOUR && hours <= END_HOUR) {
        setNowOffset(((hours - START_HOUR) / TOTAL_HOURS) * TOTAL_HEIGHT);
      } else {
        setNowOffset(null);
      }
    }
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  useEffect(() => {
    if (isOpen && isToday && nowOffset !== null && timelineRef.current) {
      setTimeout(() => {
        timelineRef.current.scrollTo({ top: Math.max(0, nowOffset - 100), behavior: 'smooth' });
      }, 300);
    }
  }, [isOpen, isToday, nowOffset]);

  const dateLabel = selectedDate.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const hours_arr = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    hours_arr.push({ hour: h, label });
  }

  return (
    <div
      className={`flex flex-col bg-column-bg border border-column-border rounded-2xl overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? 'w-72 min-w-[288px] opacity-100' : 'w-0 min-w-0 opacity-0 border-0'
      }`}
      style={{ flexShrink: 0 }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="px-3 py-3 border-b border-column-border/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-todo" />
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Calendar
              </h2>
            </div>

            {/* Date navigation */}
            <div className="flex items-center justify-between mt-2 ml-4">
              <button
                onClick={goBack}
                disabled={!canGoBack}
                className={`p-0.5 rounded transition-colors ${
                  canGoBack
                    ? 'text-text-secondary hover:text-text-primary hover:bg-column-border/30'
                    : 'text-column-border cursor-default'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div className="text-center">
                <p className="text-[10px] text-text-muted leading-tight">
                  {isToday ? 'Today' : dateLabel}
                </p>
                {isToday && (
                  <p className="text-[9px] text-text-muted/60 leading-tight">
                    {dateLabel}
                  </p>
                )}
              </div>

              <button
                onClick={goForward}
                disabled={!canGoForward}
                className={`p-0.5 rounded transition-colors ${
                  canGoForward
                    ? 'text-text-secondary hover:text-text-primary hover:bg-column-border/30'
                    : 'text-column-border cursor-default'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div ref={timelineRef} className="flex-1 overflow-y-auto pt-2">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-xs text-text-muted">Loading events...</span>
              </div>
            ) : dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="text-xs text-text-muted">No events {isToday ? 'today' : 'this day'}</span>
                <span className="text-[10px] text-text-muted">Ask Claude to sync your calendar</span>
              </div>
            ) : (
              <div className="relative" style={{ height: TOTAL_HEIGHT + 24 }}>
                {/* Hour grid */}
                {hours_arr.map(({ hour, label }) => {
                  const top = ((hour - START_HOUR) / TOTAL_HOURS) * TOTAL_HEIGHT;
                  return (
                    <div key={hour} className="absolute left-0 right-0" style={{ top }}>
                      <div className="flex items-center">
                        <span className="text-[9px] text-text-muted w-11 text-right pr-1.5 shrink-0">
                          {label}
                        </span>
                        <div className="flex-1 border-t border-column-border/40 self-start mt-[5px]" />
                      </div>
                    </div>
                  );
                })}

                {/* Now line — only on today */}
                {isToday && nowOffset !== null && (
                  <div className="absolute left-11 right-0 z-20 flex items-center" style={{ top: nowOffset }}>
                    <div className="w-2 h-2 rounded-full bg-danger -ml-1 shrink-0" />
                    <div className="flex-1 border-t border-danger" />
                  </div>
                )}

                {/* Events */}
                {dayEvents.map((event) => {
                  const top = timeToOffset(event.start);
                  const height = eventHeight(event.start, event.end);
                  const active = isNow(event.start, event.end);
                  const compact = height < 40;

                  return (
                    <div
                      key={event.id}
                      className={`absolute left-12 right-2 rounded-lg px-2 overflow-hidden transition-colors border ${
                        active
                          ? 'bg-accent-todo/15 border-accent-todo/40'
                          : 'bg-accent-progress/10 border-accent-progress/20 hover:bg-accent-progress/15'
                      }`}
                      style={{
                        top,
                        height,
                        paddingTop: compact ? 2 : 5,
                        paddingBottom: compact ? 2 : 5,
                      }}
                    >
                      {compact ? (
                        <div className="flex items-center gap-1 h-full">
                          {active && (
                            <span className="text-[7px] font-bold text-accent-todo bg-accent-todo/20 px-1 rounded shrink-0">
                              NOW
                            </span>
                          )}
                          <span className="text-[9px] font-medium text-text-primary truncate">
                            {event.subject}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-medium ${active ? 'text-accent-todo' : 'text-text-muted'}`}>
                              {formatTime(event.start)} – {formatTime(event.end)}
                            </span>
                            {active && (
                              <span className="text-[7px] font-bold text-accent-todo bg-accent-todo/20 px-1 rounded">
                                NOW
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-text-primary mt-0.5 leading-tight truncate">
                            {event.subject}
                          </p>
                          {event.location && height >= 52 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className="text-text-muted shrink-0">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span className="text-[8px] text-text-muted truncate">{event.location}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-column-border/50 shrink-0">
            <p className="text-[9px] text-text-muted text-center">
              Outlook · Ask Claude to sync
            </p>
          </div>
        </>
      )}
    </div>
  );
}
