import { render } from '@testing-library/react';
import { DialogProvider } from '../components/DialogProvider';

// Like render(), but with the app's dialog windows available (as in main.jsx)
export const renderWithDialogs = (ui, options) => render(<DialogProvider>{ui}</DialogProvider>, options);