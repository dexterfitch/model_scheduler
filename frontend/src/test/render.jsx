/**
 * Rendering for tests of pages that ask for confirmation.
 */

import { render } from '@testing-library/react';
import { DialogProvider } from '../components/DialogProvider';

/** Renders inside the shared confirmation and message windows. */
export const renderWithDialogs = (ui, options) => render(<DialogProvider>{ui}</DialogProvider>, options);
