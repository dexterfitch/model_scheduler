export const roundToNearest5 = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m;
  const rounded = Math.round(totalMins / 5) * 5;
  const newH = Math.floor(rounded / 60);
  const newM = rounded % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
};

export const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDateShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const formatDateWithWeekday = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export const formatDateTime = (d) => new Date(d).toLocaleString([], {
  weekday: 'short', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit'
});