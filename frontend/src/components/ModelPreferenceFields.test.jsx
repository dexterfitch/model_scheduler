import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelPreferenceFields from './ModelPreferenceFields';
import { DEFAULT_MODEL_PREFERENCES, applyPreferenceChange, modelSlotsPayload } from '../utils/modelPreferences';

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

  it('relabels Woman as Woman (Trans) when male genitalia is chosen', async () => {
    const { container } = render(<Harness initial={{ model_mode: 'nude' }} />);
    await userEvent.selectOptions(select(container, 'pref_genitalia'), 'Male');

    const woman = select(container, 'pref_gender').querySelector('option[value="Woman"]');
    expect(woman).toHaveTextContent('Woman (Trans)');
  });

  it('clears the genitalia choice when switching back to clothed', async () => {
    const { container } = render(<Harness initial={{ model_mode: 'nude' }} />);
    await userEvent.selectOptions(select(container, 'pref_genitalia'), 'Intersex');
    await userEvent.selectOptions(select(container, 'model_mode'), 'clothed');
    await userEvent.selectOptions(select(container, 'model_mode'), 'nude');

    expect(select(container, 'pref_genitalia')).toHaveValue('Any');
  });

  it('offers the body type options', () => {
    render(<Harness />);
    const group = screen.getByRole('radiogroup', { name: 'Body Type' });
    expect(within(group).getAllByRole('radio').map(r => r.value)).toEqual(['Any', 'Muscular', 'Average', 'Fat']);
  });

  it("doesn't offer Prefer not to say as a skin tone to ask for", () => {
    const { container } = render(<Harness />);
    const options = [...select(container, 'pref_skin_tone').options].map(o => o.value);
    expect(options).toEqual(['Any', 'Light', 'Medium', 'Dark']);
  });

  it('labels every preference so screen readers can announce them', () => {
    render(<Harness initial={{ model_mode: 'nude' }} />);
    for (const label of ['Nudity', 'Number of Models', 'Skin Tone', 'Gender', 'Body Type', 'Genitalia']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("asks for each model's preferences separately when a class needs more than one", async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText('Number of Models'), '2');

    const model2 = screen.getByRole('group', { name: 'Model 2' });
    await userEvent.click(within(model2).getByRole('radio', { name: 'Fat' }));

    expect(within(model2).getByRole('radio', { name: 'Fat' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Model 1' })).getByRole('radio', { name: 'Any' })).toBeChecked();
  });

  it('collapses to one set of preferences with "Same for every model"', async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText('Number of Models'), '2');
    await userEvent.click(screen.getByLabelText('Same for every model'));

    expect(screen.queryByRole('group', { name: 'Model 1' })).toBeNull();
    expect(screen.getByText('These preferences apply to every model in the session.')).toBeInTheDocument();
  });
});

describe('modelSlotsPayload', () => {
  const fat = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Fat', pref_genitalia: 'Any' };
  const muscular = { ...fat, pref_body_type: 'Muscular' };

  it('sends one set per model', () => {
    expect(modelSlotsPayload({ models_needed: 2, same_for_all: false, model_slots: [fat, muscular] })).toEqual([fat, muscular]);
  });

  it('sends nothing for "Same for every model" or a one-model class', () => {
    expect(modelSlotsPayload({ models_needed: 2, same_for_all: true, model_slots: [fat, muscular] })).toEqual([]);
    expect(modelSlotsPayload({ models_needed: 1, same_for_all: false, model_slots: [] })).toEqual([]);
  });
});
