import { useState } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelPreferenceFields, {
  DEFAULT_MODEL_PREFERENCES, applyPreferenceChange
} from './ModelPreferenceFields';

// Holds the form values the way the real request form does
function Harness({ initial = {} }) {
  const [values, setValues] = useState({ ...DEFAULT_MODEL_PREFERENCES, ...initial });
  return (
    <ModelPreferenceFields
      values={values}
      onChange={(name, value) => setValues(prev => applyPreferenceChange(prev, name, value))}
    />
  );
}

const select = (container, name) => container.querySelector(`select[name="${name}"]`);

describe('ModelPreferenceFields', () => {
  it('only shows the genitalia field for nude sessions', async () => {
    const { container } = render(<Harness />);
    expect(select(container, 'pref_genitalia')).toBeNull();

    await userEvent.selectOptions(select(container, 'model_mode'), 'nude');
    expect(select(container, 'pref_genitalia')).toBeInTheDocument();
  });

  it('relabels Woman as Trans Woman when male genitalia is chosen', async () => {
    const { container } = render(<Harness initial={{ model_mode: 'nude' }} />);
    await userEvent.selectOptions(select(container, 'pref_genitalia'), 'Male');

    const woman = select(container, 'pref_gender').querySelector('option[value="Woman"]');
    expect(woman).toHaveTextContent('Trans Woman');
  });

  it('clears the genitalia choice when switching back to clothed', async () => {
    const { container } = render(<Harness initial={{ model_mode: 'nude' }} />);
    await userEvent.selectOptions(select(container, 'pref_genitalia'), 'Intersex');
    await userEvent.selectOptions(select(container, 'model_mode'), 'clothed');
    await userEvent.selectOptions(select(container, 'model_mode'), 'nude');

    expect(select(container, 'pref_genitalia')).toHaveValue('Any');
  });

  it('offers the body type options', () => {
    const { container } = render(<Harness />);
    const options = [...select(container, 'pref_body_type').options].map(o => o.value);
    expect(options).toEqual(['Any', 'Muscular', 'Average', 'Fat']);
  });
});