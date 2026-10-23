import React, { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrap5Plugin from '@fullcalendar/bootstrap5';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../assets/styles/fullcalendar-overrides.css';
import { calendarTextColor } from '../utils/formatters';

const SharedCalendar = ({ events, onDateSelect, onEventClick, editable = false }) => {
  const wrapperRef = useRef(null);

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

  return (
    <div className="card shadow-sm p-3" ref={wrapperRef}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, bootstrap5Plugin]}
        themeSystem="bootstrap5"
        initialView={window.innerWidth < 992 ? 'timeGridDay' : 'timeGridWeek'}
        headerToolbar={{
          left: window.innerWidth < 992 ? 'prev,next' : 'prev,next today',
          center: 'title',
          right: window.innerWidth < 992 ? 'timeGridDay,timeGridWeek' : 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
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