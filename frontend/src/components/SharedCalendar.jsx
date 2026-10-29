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

// Phones and small tablets open on a list of the next 30 days, since a single
// day is usually empty. Bigger screens open on the week grid.
const SMALL_SCREEN = 992;

const SharedCalendar = ({ events, onDateSelect, onEventClick, editable = false }) => {
  const wrapperRef = useRef(null);
  const small = window.innerWidth < SMALL_SCREEN;

  // FullCalendar marks its arrow icons as unlabeled images. Their buttons already
  // have names ("Previous week"), so hide the icons from screen readers, including
  // any FullCalendar redraws later.
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    const hideIcons = () =>
      root.querySelectorAll('[role="img"]:not([aria-hidden])').forEach(el => el.setAttribute('aria-hidden', 'true'));
    hideIcons();
    const observer = new MutationObserver(hideIcons);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // A way to add time without tapping the grid (the list view has no grid).
  // Starts on tomorrow; the window that opens has a Date field to change it.
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
