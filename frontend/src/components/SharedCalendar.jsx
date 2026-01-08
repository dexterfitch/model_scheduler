import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid'; // Month view
import timeGridPlugin from '@fullcalendar/timegrid'; // Week/Day view
import interactionPlugin from '@fullcalendar/interaction'; // Clicks & Dragging
import bootstrap5Plugin from '@fullcalendar/bootstrap5';

import 'bootstrap-icons/font/bootstrap-icons.css'; // Icons for buttons

const SharedCalendar = ({ events, onDateSelect, onEventClick, editable = false }) => {
  return (
    <div className="card shadow-sm p-3">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, bootstrap5Plugin]}
        themeSystem="bootstrap5"
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        height="auto"
        selectable={true} // Allows clicking/dragging to select time
        editable={editable} // Allows dragging events (if enabled)
        events={events} // The data to show
        select={onDateSelect} // Callback for selecting a time slot
        eventClick={onEventClick} // Callback for clicking an event
        
        // Visual tweaks
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        slotMinTime="08:00:00" // Start calendar at 8 AM
        slotMaxTime="22:00:00" // End at 10 PM
      />
    </div>
  );
};

export default SharedCalendar;