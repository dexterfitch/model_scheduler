import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const renderAt = (path, props = {}) => render(<MemoryRouter initialEntries={[path]}><LoginPage {...props} /></MemoryRouter>);

describe('LoginPage', () => {
  it('shows why the last sign-in was turned away', () => {
    renderAt('/login?error=Please+sign+in+with+your+MICA+Google+account.');
    expect(screen.getByText('Please sign in with your MICA Google account.')).toBeInTheDocument();
  });

  it('shows a message the app passes in, such as an expired sign-in', () => {
    renderAt('/login', { notice: 'Your sign-in has expired. Please sign in again.' });
    expect(screen.getByText('Your sign-in has expired. Please sign in again.')).toBeInTheDocument();
  });

  it('signs in through the same backend address as the rest of the app', () => {
    renderAt('/login');
    const link = screen.getByRole('link', { name: 'Sign in with MICA Google Account' });
    expect(link).toHaveAttribute('href', 'http://localhost:3000/auth/google_oauth2');
  });

  it("doesn't load pictures from other websites", () => {
    const { container } = renderAt('/login');
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('src')).not.toMatch(/^https?:/);
    }
  });
});
