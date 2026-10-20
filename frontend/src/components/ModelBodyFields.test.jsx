import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelBodyFields from './ModelBodyFields';

const select = (container, name) => container.querySelector(`select[name="${name}"]`);

describe('ModelBodyFields', () => {
  it('hides the genitalia question from models who only pose clothed', () => {
    const { container } = render(<ModelBodyFields values={{ willing_to_model_nude: false }} onChange={() => {}} />);
    expect(select(container, 'genitalia')).toBeNull();
  });

  it('asks nude-willing models about genitalia, with a privacy note', () => {
    const { container } = render(<ModelBodyFields values={{ willing_to_model_nude: true }} onChange={() => {}} />);
    expect(select(container, 'genitalia')).toBeInTheDocument();
    expect(screen.getByText(/only visible to admins/i)).toBeInTheDocument();
  });

  it('lets models skip both questions', () => {
    const { container } = render(<ModelBodyFields values={{ willing_to_model_nude: true }} onChange={() => {}} />);
    expect(select(container, 'body_type')).toHaveValue('');
    expect(select(container, 'genitalia')).toHaveValue('');
  });

  it('reports the chosen body type', async () => {
    const onChange = vi.fn();
    const { container } = render(<ModelBodyFields values={{}} onChange={onChange} />);
    await userEvent.selectOptions(select(container, 'body_type'), 'Average');
    expect(onChange).toHaveBeenCalledWith('body_type', 'Average');
  });
});