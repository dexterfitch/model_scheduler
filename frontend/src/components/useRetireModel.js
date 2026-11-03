/**
 * Retiring a model and bringing them back, with the same confirmation and messages on
 * every page that offers it (the Directory and a model's own page).
 */

import api from '../services/api';
import { useDialog } from './DialogProvider';
import { extractErrorMessages } from '../utils/formatters';

/**
 * A function that retires a model after saying what that means, or brings a retired
 * model back. It resolves with the updated person and a message to show, or with null
 * if the admin went back or it couldn't be done (the reason is shown).
 */
export function useRetireModel() {
  const { confirm, notify } = useDialog();

  return async (user) => {
    const name = `${user.first_name} ${user.last_name}`;
    if (!user.retired_at) {
      const confirmed = await confirm({
        title: `Retire ${name}?`,
        message: `${user.first_name} won't be offered for classes, counted as free, or emailed by Notify Models, and can't add free time. Their upcoming free time is removed; past gigs stay. You can bring them back later.`,
        confirmLabel: 'Retire Model',
        cancelLabel: 'Go Back',
        danger: true
      });
      if (!confirmed) return null;
    }
    try {
      const res = await api.post(`/users/${user.id}/${user.retired_at ? 'reinstate' : 'retire'}`);
      return { user: res.data, message: res.data.retired_at ? `${name} is retired.` : `${name} is back in the pool.` };
    } catch (err) {
      notify({ title: user.retired_at ? "Couldn't bring them back" : "Couldn't retire this model", message: extractErrorMessages(err, 'Please try again.') });
      return null;
    }
  };
}
