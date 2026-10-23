import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SkinTonePicker from './SkinTonePicker';

function Harness({ initial = '', onChange = () => {} }) {
  const [value, setValue] = useState(initial);
  return <SkinTonePicker value={value} onChange={(v) => { setValue(v); onChange(v); }} />;
}

describe('SkinTonePicker', () => {
  it('is a named group of real radio buttons', () => {
    render(<Harness initial="Medium" />);
    expect(screen.getByRole('radiogroup', { name: /Skin Tone/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked();
  });

  it('can be chosen with a click', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('Dark');
  });

  it('can be chosen with the keyboard alone', async () => {
    const onChange = vi.fn();
    render(<Harness initial="Light" onChange={onChange} />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('Medium');
  });
});