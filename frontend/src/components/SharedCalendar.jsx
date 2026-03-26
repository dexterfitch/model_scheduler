import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import bootstrap5Plugin from '@fullcalendar/bootstrap5';

import 'bootstrap-icons/font/bootstrap-icons.css';

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
        selectable={true}
        editable={editable}
        events={events}
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