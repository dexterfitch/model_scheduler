import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CorrectRecordModal from './CorrectRecordModal';
import api from '../services/api';
import { daysFromNow } from '../test/dates';
import { formatTimeForInput } from '../utils/time';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const jordan = { id: 1, first_name: 'Jordan', last_name: 'Ellis', role: 'model', willing_to_model_nude: true };
const riley  = { id: 2, first_name: 'Riley', last_name: 'Okafor', role: 'model', willing_to_model_nude: false };
const devon  = { id: 3, first_name: 'Devon', last_name: 'Price', role: 'model', willing_to_model_nude: true };
const alice  = { id: 9, first_name: 'Alice', last_name: 'Chen', role: 'faculty' };

const date = { id: 11, starts_at: daysFromNow(-7, 10), ends_at: daysFromNow(-7, 12) };
const series = { id: 5, class_name: 'Gesture Drawing', model_mode: 'clothed' };
const booked = (extra = {}) => ({
  id: 100, status: 'confirmed', billable: null, no_show: false,
  art_model_availability: { user: jordan }, corrections: [], ...extra
});

const onSaved = vi.fn();
const onClose = vi.fn();
const open = (gig = booked(), s = series) =>
  render(<CorrectRecordModal gig={gig} date={date} series={s} onSaved={onSaved} onClose={onClose} />);
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save Correction' }));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [jordan, riley, devon, alice] });
  api.post.mockResolvedValue({ data: {} });
});

describe('CorrectRecordModal', () => {
  it('starts by explaining what a correction does and does not do', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Correct the record' });
    expect(dialog).toHaveTextContent('This date has already happened.');
    expect(dialog).toHaveTextContent('Nobody is emailed, and no one is rebooked.');
    expect(dialog).toHaveTextContent('Jordan Ellis');
    expect(dialog).toHaveTextContent('Confirmed');
  });

  it("can't be saved until something is chosen", () => {
    open();
    expect(screen.getByRole('button', { name: 'Save Correction' })).toBeDisabled();
  });

  it('records a no-show, with an optional note', async () => {
    open();
    await userEvent.click(screen.getByRole('radio', { name: "Jordan didn't show up (not paid)" }));
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'Alice says nobody came');
    await save();
    expect(api.post).toHaveBeenCalledWith('/gigs/100/corrections', {
      correction: { kind: 'no_show', note: 'Alice says nobody came' }
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('offers to undo a no-show instead of recording another', () => {
    open(booked({ status: 'cancelled', billable: false, no_show: true }));
    expect(screen.queryByRole('radio', { name: /didn't show up/ })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Undo the no-show (Jordan did come)' })).toBeInTheDocument();
  });

  it('offers the opposite of how the gig is paid now', () => {
    open();
    expect(screen.getByRole('radio', { name: "Don't pay this gig" })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Pay this gig' })).toBeNull();
  });

  it('pays a cancellation the coordinator decided to honour', async () => {
    open(booked({ status: 'cancelled', billable: false }));
    await userEvent.click(screen.getByRole('radio', { name: 'Pay this gig' }));
    await save();
    expect(api.post).toHaveBeenCalledWith('/gigs/100/corrections', { correction: { kind: 'paid' } });
  });

  it('records the hours really worked, starting from the booked times', async () => {
    open();
    await userEvent.click(screen.getByRole('radio', { name: 'Fix the hours Jordan worked' }));
    const start = screen.getByLabelText('Started');
    const end = screen.getByLabelText('Finished');
    // The booked times, in the computer's own time zone
    const local = (iso) => formatTimeForInput(new Date(iso));
    expect(start).toHaveValue(local(date.starts_at));
    expect(end).toHaveValue(local(date.ends_at));
    fireEvent.change(end, { target: { value: local(new Date(new Date(date.starts_at).getTime() + 90 * 60000).toISOString()) } });
    await save();

    const { correction } = api.post.mock.calls[0][1];
    expect(correction.kind).toBe('hours');
    expect(new Date(correction.worked_starts_at).getTime()).toBe(new Date(date.starts_at).getTime());
    expect(new Date(correction.worked_ends_at).getTime()).toBe(new Date(date.starts_at).getTime() + 90 * 60000);
  });

  it('can put corrected hours back to the booked times', async () => {
    open(booked({ worked_starts_at: date.starts_at, worked_ends_at: daysFromNow(-7, 11) }));
    await userEvent.click(screen.getByRole('radio', { name: 'Go back to the booked hours' }));
    await save();
    expect(api.post).toHaveBeenCalledWith('/gigs/100/corrections', { correction: { kind: 'hours', reset_hours: true } });
  });

  it('records who covered, offering only other models who could take the class', async () => {
    open(booked(), { ...series, model_mode: 'nude' });
    await userEvent.click(screen.getByRole('radio', { name: 'Someone else covered for Jordan' }));
    const picker = await screen.findByLabelText('Model who covered');
    const choices = within(picker).getAllByRole('option').map(o => o.textContent);
    // Not Jordan, not faculty, and not Riley, who only models clothed
    expect(choices).toEqual(['Choose a model', 'Devon Price']);

    await userEvent.selectOptions(picker, 'Devon Price');
    await save();
    expect(api.post).toHaveBeenCalledWith('/gigs/100/corrections', { correction: { kind: 'covered_by', stand_in_user_id: 3 } });
  });

  it('shows what has already been corrected, by whom, and why', () => {
    open(booked({ corrections: [{
      id: 1, kind: 'unpaid', summary: 'Set to not paid', note: 'Left early',
      created_at: '2026-10-30T14:00:00Z', user: { first_name: 'Pat', last_name: 'Reyes' }
    }] }));
    const history = screen.getByRole('list', { name: 'Corrections so far' });
    expect(history).toHaveTextContent('Set to not paid');
    expect(history).toHaveTextContent('Pat Reyes');
    expect(history).toHaveTextContent('Left early');
  });

  it("explains why the server wouldn't save the correction, and stays open", async () => {
    api.post.mockRejectedValue({ response: { data: { errors: ['Someone else is recorded in this spot.'] } } });
    open();
    await userEvent.click(screen.getByRole('radio', { name: "Don't pay this gig" }));
    await save();
    expect(await screen.findByText('Someone else is recorded in this spot.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
