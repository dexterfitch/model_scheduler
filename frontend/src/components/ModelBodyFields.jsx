import React, { useId } from "react";
import { BODY_TYPES, GENITALIA_OPTIONS } from "../utils/constants";

// Optional model-profile fields used for matching. Genitalia is only asked of
// models who are willing to pose nude, and is only visible to admins.
function ModelBodyFields({ values, onChange, labelClassName = "form-label" }) {
  const handle = (e) => onChange(e.target.name, e.target.value);
  // Unique ids, so labels still work if this appears twice on one page.
  const id = useId();
  const bodyTypeId = `${id}-body-type`;
  const genitaliaId = `${id}-genitalia`;
  const genitaliaHelpId = `${id}-genitalia-help`;

  return (
    <div className="row mb-3">
      <div className="col-md-6 mb-3 mb-md-0">
        <label className={labelClassName} htmlFor={bodyTypeId}>Body Type</label>
        <select id={bodyTypeId} className="form-select" name="body_type" value={values.body_type || ""} onChange={handle}>
          <option value="">Prefer not to say</option>
          {BODY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      {values.willing_to_model_nude && (
        <div className="col-md-6">
          <label className={labelClassName} htmlFor={genitaliaId}>Genitalia</label>
          <select id={genitaliaId} className="form-select" name="genitalia" value={values.genitalia || ""} onChange={handle} aria-describedby={genitaliaHelpId}>
            <option value="">Prefer not to say</option>
            {GENITALIA_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div id={genitaliaHelpId} className="form-text">Only visible to admins, and only used to match nude sessions.</div>
        </div>
      )}
    </div>
  );
}

export default ModelBodyFields;