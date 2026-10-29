import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserDirectory from './UserDirectory';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

describe('UserDirectory', () => {
  it('leaves out the Pronouns badge when a model has not entered any', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu', pronouns: 'they/them', skin_tone: 'Light', gender_identity: 'Woman' },
      { id: 2, role: 'model', first_name: 'Sam', last_name: 'Marsh', email: 'smarsh@mica.edu', pronouns: '', skin_tone: 'Dark', gender_identity: 'Man' }
    ] });
    render(<MemoryRouter><UserDirectory /></MemoryRouter>);

    expect((await screen.findAllByText('Pronouns: they/them')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^Pronouns:\s*$/)).toHaveLength(0);
  });

  it('shows body type as a plain badge, the same height as the others', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, role: 'model', first_name: 'Jordan', last_name: 'Ellis', email: 'jellis@mica.edu', skin_tone: 'Light', gender_identity: 'Woman', body_type: 'Fat' }
    ] });
    render(<MemoryRouter><UserDirectory /></MemoryRouter>);

    const [badge] = await screen.findAllByText('Fat Build');
    expect(badge.querySelector('svg')).toBeNull();
  });
});
