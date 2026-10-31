/**
 * The calendar used on every calendar page. Phones open on a 30-day list; wider
 * screens on the week. Can offer Add Availability for pages where time can be added.
 */

import React, { useEffect, useRef } from 'react';
import { Button } from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrap5Plugin from '@fullcalendar/bootstrap5';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../assets/styles/fullcalendar-overrides.css';
import { calendarTextColor } from '../utils/formatters';

const SMALL_SCREEN = 992;

/** A calendar of the given events. */
const SharedCalendar = ({ events, onDateSelect, onEventClick, editable = false }) => {
  const wrapperRef = useRef(null);
  const small = window.innerWidth < SMALL_SCREEN;

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    /** Hides the calendar's arrow icons from screen readers; their buttons already have names. */
    const hideIcons = () =>
      root.querySelectorAll('[role="img"]:not([aria-hidden])').forEach(el => el.setAttribute('aria-hidden', 'true'));
    hideIcons();
    const observer = new MutationObserver(hideIcons);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  /** Opens the add window on tomorrow's date, without tapping the grid. */
  const addNew = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onDateSelect({ startStr: tomorrow.toLocaleDateString('en-CA') });
  };

  return (
    <div className="card shadow-sm p-3" ref={wrapperRef}>
      {editable && onDateSelect && (
        <div className="d-flex justify-content-end mb-2">
          <Button variant="success" onClick={addNew}>
            <i className="bi bi-plus-circle me-1" aria-hidden="true"></i> Add Availability
          </Button>
        </div>
      )}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, bootstrap5Plugin]}
        themeSystem="bootstrap5"
        views={{
          listUpcoming: { type: 'list', duration: { days: 30 }, buttonText: 'List' }
        }}
        initialView={small ? 'listUpcoming' : 'timeGridWeek'}
        headerToolbar={{
          left: small ? 'prev,next' : 'prev,next today',
          center: 'title',
          right: small ? 'listUpcoming,timeGridDay,timeGridWeek' : 'dayGridMonth,timeGridWeek,timeGridDay,listUpcoming'
        }}
        noEventsContent="Nothing scheduled in these 30 days."
        height="auto"
        selectable={true}
        editable={editable}
        events={events.map(e => ({ textColor: calendarTextColor(e.backgroundColor), ...e }))}
        select={onDateSelect}
        eventClick={onEventClick}

        displayEventEnd={true}

        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        slotMinTime="08:00:00"
        slotMaxTime="22:00:00"
      />
    </div>
  );
};

export default SharedCalendar;
