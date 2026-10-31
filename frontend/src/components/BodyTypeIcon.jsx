/**
 * Outline figures for the body type choices. Decorative: the word next to them says the same.
 */

import React from 'react';

const FIGURES = {
  Muscular: "M 21 13.6 Q 14.2 13.6 12.3 17.2 Q 8.6 21.5 9.6 28.8 Q 9.8 31.2 11.6 31.2 Q 13.3 31.2 13.1 29.2 Q 12.8 24.8 15.4 22 L 19 31.2 L 19 44.6 Q 19 46.4 20.8 46.4 L 21.4 46.4 Q 23 46.4 23 44.6 L 23 34.6 Q 23 33.6 24 33.6 Q 25 33.6 25 34.6 L 25 44.6 Q 25 46.4 26.6 46.4 L 27.2 46.4 Q 29 46.4 29 44.6 L 29 31.2 L 32.6 22 Q 35.2 24.8 34.9 29.2 Q 34.7 31.2 36.4 31.2 Q 38.2 31.2 38.4 28.8 Q 39.4 21.5 35.7 17.2 Q 33.8 13.6 27 13.6",
  Average: "M 21 13.6 Q 16.5 13.8 15.3 17 L 12.6 28.6 Q 12.4 31 14.2 31 Q 15.6 31 15.8 29.4 L 18 21 L 18 44.6 Q 18 46.4 19.8 46.4 L 21.4 46.4 Q 23 46.4 23 44.6 L 23 33.4 Q 23 32.4 24 32.4 Q 25 32.4 25 33.4 L 25 44.6 Q 25 46.4 26.6 46.4 L 28.2 46.4 Q 30 46.4 30 44.6 L 30 21 L 32.2 29.4 Q 32.4 31 33.8 31 Q 35.6 31 35.4 28.6 L 32.7 17 Q 31.5 13.8 27 13.6",
  Fat: "M 21 13.6 Q 14.5 13.8 12.8 17.8 L 9.8 28.6 Q 9.6 31 11.4 31 Q 12.8 31 13.1 29.4 L 15.6 22.4 Q 10.6 31.5 14.2 39 Q 15.6 42 15.8 44.6 Q 16 46.4 17.8 46.4 L 21.4 46.4 Q 23 46.4 23 44.6 L 23 38 Q 23 37 24 37 Q 25 37 25 38 L 25 44.6 Q 25 46.4 26.6 46.4 L 30.2 46.4 Q 32 46.4 32.2 44.6 Q 32.4 42 33.8 39 Q 37.4 31.5 32.4 22.4 L 34.9 29.4 Q 35.2 31 36.6 31 Q 38.4 31 38.2 28.6 L 35.2 17.8 Q 33.5 13.8 27 13.6",
};

/** The figure for Muscular, Average or Fat, or nothing for any other value. */
function BodyTypeIcon({ type, size = 20, className }) {
  const figure = FIGURES[type];
  if (!figure) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false"
      className={className} data-body-type={type}
      fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
    >
      <circle cx="24" cy="7.4" r="4.8" />
      <path d={figure} />
    </svg>
  );
}

export default BodyTypeIcon;
