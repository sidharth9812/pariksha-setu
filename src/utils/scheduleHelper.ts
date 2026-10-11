import { TestItem } from '../types/exam';

export interface TestScheduleInfo {
  isScheduled: boolean;
  scheduleStatus: 'upcoming' | 'live' | 'expired' | 'open';
  formattedDate: string;
  formattedStartTime: string;
  formattedEndTime: string;
  startDateTime: Date | null;
  endDateTime: Date | null;
  canStart: boolean;
  timeRemainingText: string;
  statusBadgeText: string;
  statusBadgeClass: string;
}

/**
 * Parses startDate (e.g. "2026-10-01", "2026-10-01T10:00:00.000Z", or Date) and startTime (e.g. "10:00 AM", "14:30")
 * into a valid Date object. Resilient to various date & time formats, Firestore timestamps, and ISO strings.
 */
export function parseScheduleDateTime(startDate?: any, startTime?: any): Date | null {
  if (!startDate) return null;

  try {
    // 1. If startDate is already a Date object
    if (startDate instanceof Date) {
      if (!isNaN(startDate.getTime())) return startDate;
      return null;
    }

    // 2. If startDate is a Firestore Timestamp with toDate() or seconds
    if (typeof startDate === 'object' && startDate !== null) {
      if (typeof startDate.toDate === 'function') {
        const d = startDate.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      }
      if (typeof startDate.seconds === 'number') {
        const d = new Date(startDate.seconds * 1000);
        if (!isNaN(d.getTime())) return d;
      }
    }

    let cleanDate = String(startDate).trim();
    if (!cleanDate) return null;

    let parsedTimeHours: number | null = null;
    let parsedTimeMinutes: number | null = null;

    // Check if cleanDate contains 'T' (e.g. ISO string "2026-10-01T10:00:00.000Z" or "2026-10-01T10:00")
    if (cleanDate.includes('T')) {
      const parts = cleanDate.split('T');
      cleanDate = parts[0].trim();
      const isoTime = parts[1];
      if ((!startTime || !String(startTime).trim()) && isoTime) {
        const timeMatch = isoTime.match(/(\d{1,2}):(\d{1,2})/);
        if (timeMatch) {
          parsedTimeHours = parseInt(timeMatch[1], 10);
          parsedTimeMinutes = parseInt(timeMatch[2], 10);
        }
      }
    }

    let year = 0;
    let month = 0;
    let day = 0;

    if (cleanDate.includes('-')) {
      const parts = cleanDate.split('-').map((p) => parseInt(p, 10));
      if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        if (parts[0] > 1000) {
          // YYYY-MM-DD
          year = parts[0];
          month = parts[1];
          day = parts[2];
        } else {
          // DD-MM-YYYY
          day = parts[0];
          month = parts[1];
          year = parts[2];
        }
      }
    } else if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/').map((p) => parseInt(p, 10));
      if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        if (parts[0] > 1000) {
          // YYYY/MM/DD
          year = parts[0];
          month = parts[1];
          day = parts[2];
        } else {
          // DD/MM/YYYY
          day = parts[0];
          month = parts[1];
          year = parts[2];
        }
      }
    }

    // Fallback standard JS Date constructor
    if (!year || !month || !day) {
      const direct = new Date(cleanDate);
      if (!isNaN(direct.getTime())) {
        year = direct.getFullYear();
        month = direct.getMonth() + 1;
        day = direct.getDate();
        if (parsedTimeHours === null) parsedTimeHours = direct.getHours();
        if (parsedTimeMinutes === null) parsedTimeMinutes = direct.getMinutes();
      } else {
        return null;
      }
    }

    let hours = parsedTimeHours !== null ? parsedTimeHours : 0;
    let minutes = parsedTimeMinutes !== null ? parsedTimeMinutes : 0;

    const timeStr = startTime ? String(startTime).trim() : '';
    if (timeStr) {
      const match = timeStr.match(/(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = match[2] ? parseInt(match[2], 10) : 0;
        const meridian = match[3] ? match[3].toLowerCase() : null;

        if (meridian === 'pm' && hours < 12) {
          hours += 12;
        } else if (meridian === 'am' && hours === 12) {
          hours = 0;
        }
      }
    }

    const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (isNaN(result.getTime())) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Evaluates the full scheduling status of any test for student presentation.
 */
export function getTestScheduleInfo(test: TestItem, nowMs: number = Date.now()): TestScheduleInfo {
  // Extract schedule fields, supporting both canonical and alternate naming in database
  const rawStartDate =
    test.startDate ||
    (test as any).scheduleDate ||
    (test as any).scheduledDate ||
    (test as any).scheduledAt ||
    (test as any).examDate ||
    (test as any).date;

  const rawStartTime =
    test.startTime ||
    (test as any).scheduleTime ||
    (test as any).scheduledTime ||
    (test as any).examStartTime ||
    (test as any).time;

  // Parse start date & time first
  let startDateTime = parseScheduleDateTime(rawStartDate, rawStartTime);

  // Determine if this test is scheduled:
  // 1. Explicitly status === 'scheduled' (Admin explicitly chose "Scheduled")
  // 2. OR status !== 'draft' and has a configured schedule date in the future
  const isScheduledByStatus = test.status === 'scheduled' || (test as any).scheduleStatus === 'scheduled';
  const hasScheduleDate = Boolean(rawStartDate && String(rawStartDate).trim());

  // If explicitly status is 'scheduled' but no valid start date was parsed, provide a future scheduled fallback
  if (isScheduledByStatus && !startDateTime) {
    const fallback = new Date(nowMs);
    fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
    startDateTime = fallback;
  }

  const isFutureSchedule = Boolean(startDateTime && startDateTime.getTime() > nowMs);
  const isScheduled =
    isScheduledByStatus ||
    (hasScheduleDate &&
      isFutureSchedule &&
      test.status !== 'draft' &&
      test.status !== 'live' &&
      test.status !== 'completed' &&
      test.status !== 'result_published');

  // If NOT scheduled and test is marked 'released', it is an open practice test
  if (!isScheduled && test.status === 'released') {
    return {
      isScheduled: false,
      scheduleStatus: 'open',
      formattedDate: 'Open Practice',
      formattedStartTime: 'Anytime',
      formattedEndTime: `${Number(test.durationMinutes) || 60} Mins`,
      startDateTime: null,
      endDateTime: null,
      canStart: true,
      timeRemainingText: 'Unlimited Reattempts Available',
      statusBadgeText: 'Released Test',
      statusBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }

  const durationMs = (Number(test.durationMinutes) || 60) * 60 * 1000;

  let endDateTime: Date | null = null;
  const rawEndTime = test.examEndTime || (test as any).endDate || (test as any).scheduledEndTime;
  if (rawEndTime) {
    const end = parseScheduleDateTime(rawEndTime);
    if (end && !isNaN(end.getTime())) endDateTime = end;
  }
  if (!endDateTime && startDateTime) {
    endDateTime = new Date(startDateTime.getTime() + durationMs);
  }

  // Format dates human-readably
  let formattedDate = rawStartDate ? String(rawStartDate) : 'Upcoming Date';
  let formattedStartTime = rawStartTime ? String(rawStartTime) : 'Scheduled Time';
  let formattedEndTime = `${Number(test.durationMinutes) || 60} Minutes`;

  if (startDateTime) {
    formattedDate = startDateTime.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    formattedStartTime = startDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  if (endDateTime) {
    formattedEndTime = endDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Live Exam explicitly started by Admin
  if (test.status === 'live') {
    return {
      isScheduled: Boolean(isScheduled),
      scheduleStatus: 'live',
      formattedDate,
      formattedStartTime,
      formattedEndTime,
      startDateTime,
      endDateTime,
      canStart: true,
      timeRemainingText: 'Exam is Live Now',
      statusBadgeText: 'Live Exam',
      statusBadgeClass: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
    };
  }

  // Waiting Room open
  if (test.status === 'waiting') {
    return {
      isScheduled: Boolean(isScheduled),
      scheduleStatus: 'live',
      formattedDate,
      formattedStartTime,
      formattedEndTime,
      startDateTime,
      endDateTime,
      canStart: true,
      timeRemainingText: 'Waiting Room Open',
      statusBadgeText: 'Waiting Room',
      statusBadgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }

  // Completed or Result Published
  if (test.status === 'completed' || test.status === 'result_published') {
    return {
      isScheduled: Boolean(isScheduled),
      scheduleStatus: 'expired',
      formattedDate,
      formattedStartTime,
      formattedEndTime,
      startDateTime,
      endDateTime,
      canStart: false,
      timeRemainingText: 'Examination Concluded',
      statusBadgeText: 'Completed / Expired',
      statusBadgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    };
  }

  // If not scheduled, it is a standard published test
  if (!isScheduled || !startDateTime) {
    return {
      isScheduled: false,
      scheduleStatus: 'open',
      formattedDate: 'Available Now',
      formattedStartTime: 'Immediate Access',
      formattedEndTime: `${Number(test.durationMinutes) || 60} Mins`,
      startDateTime: null,
      endDateTime: null,
      canStart: true,
      timeRemainingText: 'Available to take now',
      statusBadgeText: 'Active Test',
      statusBadgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    };
  }

  // We have a scheduled test with startDateTime!
  const startMs = startDateTime.getTime();
  const endMs = endDateTime ? endDateTime.getTime() : startMs + durationMs;

  // Case 1: Before scheduled start time (Upcoming)
  if (nowMs < startMs) {
    const diffMs = startMs - nowMs;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);

    let timeText = `Starts on ${formattedDate} at ${formattedStartTime}`;
    if (diffDays >= 1) {
      timeText = `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''} (${formattedStartTime})`;
    } else if (diffHours >= 1) {
      timeText = `Starts in ${diffHours}h ${diffMins}m`;
    } else if (diffMins > 0) {
      timeText = `Starts in ${diffMins} minutes`;
    } else {
      timeText = 'Starting in less than 1 minute';
    }

    return {
      isScheduled: true,
      scheduleStatus: 'upcoming',
      formattedDate,
      formattedStartTime,
      formattedEndTime,
      startDateTime,
      endDateTime,
      canStart: false,
      timeRemainingText: timeText,
      statusBadgeText: 'Upcoming',
      statusBadgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    };
  }

  // Case 2: At or during scheduled window (Live / Active)
  if (nowMs >= startMs && nowMs <= endMs) {
    const remainingMs = endMs - nowMs;
    const remainingMins = Math.max(1, Math.floor(remainingMs / (1000 * 60)));

    return {
      isScheduled: true,
      scheduleStatus: 'live',
      formattedDate,
      formattedStartTime,
      formattedEndTime,
      startDateTime,
      endDateTime,
      canStart: true,
      timeRemainingText: `Window active • ${remainingMins} mins remaining`,
      statusBadgeText: 'Live / Available Now',
      statusBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse',
    };
  }

  // Case 3: After scheduled window (Expired / Ended)
  return {
    isScheduled: true,
    scheduleStatus: 'expired',
    formattedDate,
    formattedStartTime,
    formattedEndTime,
    startDateTime,
    endDateTime,
    canStart: false,
    timeRemainingText: 'Scheduled window has closed',
    statusBadgeText: 'Completed / Expired',
    statusBadgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  };
}
