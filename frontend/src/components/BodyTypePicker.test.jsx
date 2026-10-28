import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BodyTypePicker from './BodyTypePicker';
import BodyTypeIcon from './BodyTypeIcon';

describe('BodyTypePicker', () => {
  it('offers each body type as a radio button with its icon and its word on screen', () => {
    render(<BodyTypePicker value="" onChange={() => {}} noneLabel="Prefer not to say" />);
    const group = screen.getByRole('radiogroup', { name: 'Body Type' });

    for (const name of ['Prefer not to say', 'Muscular', 'Average', 'Fat']) {
      expect(within(group).getByRole('radio', { name })).toBeInTheDocument();
      expect(within(group).getByText(name)).toBeVisible();
    }
    // The pictures are decoration: the visible word already says what they mean
    for (const icon of group.querySelectorAll('svg')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('shows the current choice and reports a new one', async () => {
    const onChange = vi.fn();
    render(<BodyTypePicker value="Average" onChange={onChange} noneLabel="Any" noneValue="Any" />);
    expect(screen.getByRole('radio', { name: 'Average' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'Fat' }));
    expect(onChange).toHaveBeenCalledWith('Fat');
    await userEvent.click(screen.getByRole('radio', { name: 'Any' }));
    expect(onChange).toHaveBeenCalledWith('Any');
  });
});

describe('BodyTypeIcon', () => {
  it('draws a different figure for each body type, hidden from screen readers', () => {
    const { container } = render(<>{['Muscular', 'Average', 'Fat'].map(t => <BodyTypeIcon key={t} type={t} />)}</>);
    const paths = [...container.querySelectorAll('svg path')].map(p => p.getAttribute('d'));
    expect(new Set(paths).size).toBe(3);
    container.querySelectorAll('svg').forEach(svg => expect(svg).toHaveAttribute('aria-hidden', 'true'));
  });

  it('draws nothing for a type it does not know', () => {
    const { container } = render(<BodyTypeIcon type="Any" />);
    expect(container).toBeEmptyDOMElement();
  });
});
