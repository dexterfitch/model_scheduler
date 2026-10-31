/**
 * Why are we asking?: explains what the personal questions are for and who sees the answers.
 */

import React, { useId, useState } from 'react';

/** A toggle that opens and closes the explanation. */
function PersonalQuestionsNote() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mb-3">
      <button
        type="button"
        className="btn btn-link p-0 text-decoration-underline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
      >
        <i className="bi bi-question-circle me-1" aria-hidden="true"></i>Why are we asking?
      </button>
      {open && (
        <div id={panelId} className="border rounded p-3 mt-2 small bg-white">
          <p className="mb-2">
            Faculty sometimes ask for a particular kind of model for a class, such as a figure study
            of a muscular build. Your answers help the model coordinator match you with art classes
            you're a good fit for. They're used for nothing else.
          </p>
          <p className="mb-2">
            You don't have to answer: each question has a <strong>Prefer not to say</strong> option,
            and you can change your answers here at any time.
          </p>
          <p className="mb-0">
            Only the model coordinator and the app's administrator can see your answers. Faculty never see your name or your answers: they only see the preferences
            they set on their own requests. Nothing is shared outside this app.
          </p>
        </div>
      )}
    </div>
  );
}

export default PersonalQuestionsNote;
