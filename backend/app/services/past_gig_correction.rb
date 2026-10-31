# Fixes the record of a gig whose class has already started: a no-show (or undoing
# one), paying or not paying a cancellation, the hours really worked, or another
# model who covered. Nothing here emails or rebooks anyone; it only changes the
# record that billing reads, and logs each change as a GigCorrection.
class PastGigCorrection
  # A correction that can't be made, with a message for the admin.
  class Error < StandardError; end

  ZONE = "Eastern Time (US & Canada)".freeze

  # A correction to the given gig, made by the given admin, as described by params.
  def initialize(gig:, admin:, params:)
    @gig = gig
    @admin = admin
    @params = params
  end

  # Makes the correction and logs it. Raises Error if it can't be made.
  def apply!
    if klass.starts_at > Time.current
      raise Error, "This date hasn't happened yet. Use Release Model to change who's booked."
    end

    Gig.transaction do
      summary = case @params[:kind].to_s
                when "no_show"      then mark_no_show!
                when "undo_no_show" then undo_no_show!
                when "paid"         then set_paid!(true)
                when "unpaid"       then set_paid!(false)
                when "hours"        then fix_hours!
                when "covered_by"   then record_cover!
                else raise Error, "Choose what to correct."
                end
      record!(@gig, @params[:kind].to_s, summary)
    end
    @gig
  rescue ActiveRecord::RecordInvalid => e
    raise Error, e.record.errors.full_messages.to_sentence
  end

  private

  # The class date of the gig.
  def klass
    @gig.faculty_request
  end

  # The admin's note, if they wrote one.
  def note
    @params[:note].to_s.strip.presence
  end

  # Logs a correction against a gig.
  def record!(gig, kind, summary)
    gig.gig_corrections.create!(user: @admin, kind: kind, summary: summary, note: note)
  end

  # The model's full name.
  def name_of(gig)
    user = gig.art_model_availability.user
    "#{user.first_name} #{user.last_name}"
  end

  # A time as Eastern clock time, like 1:30 PM.
  def time(t)
    t.in_time_zone(ZONE).strftime("%-l:%M %p")
  end

  # Marks the model as a no-show, unpaid.
  def mark_no_show!
    raise Error, "#{name_of(@gig)} is already recorded as a no-show." if @gig.no_show
    no_show!(@gig)
    "Marked #{name_of(@gig)} as a no-show (not paid)"
  end

  # Cancels the gig as a no-show, unpaid.
  def no_show!(gig)
    gig.update_columns(status: Gig.statuses[:cancelled], billable: false, no_show: true, updated_at: Time.current)
  end

  # Puts a no-show back to worked and paid, if their spot hasn't been given to someone else.
  def undo_no_show!
    raise Error, "#{name_of(@gig)} isn't recorded as a no-show." unless @gig.no_show
    if klass.confirmed_gigs.count >= klass.models_needed
      raise Error, "Someone else is recorded in this spot. Correct their gig first."
    end

    @gig.update_columns(status: Gig.statuses[:confirmed], billable: nil, no_show: false, updated_at: Time.current)
    "Undid the no-show: #{name_of(@gig)} is paid again"
  end

  # Pays or stops paying a cancellation. A model who worked is always paid, so only
  # cancellations (not no-shows) can change.
  def set_paid!(paid)
    unless @gig.cancelled? && !@gig.no_show
      raise Error, "A model who worked is always paid. Use No-show if they didn't come, or Fix the hours if they worked less."
    end
    @gig.update_columns(billable: paid, updated_at: Time.current)
    paid ? "Paid the cancellation" : "Stopped paying the cancellation"
  end

  # Records the hours really worked (at most 12), or goes back to the booked hours.
  def fix_hours!
    if ActiveModel::Type::Boolean.new.cast(@params[:reset_hours])
      @gig.update_columns(worked_starts_at: nil, worked_ends_at: nil, updated_at: Time.current)
      return "Hours set back to the booked #{time(klass.starts_at)} – #{time(klass.ends_at)}"
    end

    from = parse(@params[:worked_starts_at])
    to = parse(@params[:worked_ends_at])
    raise Error, "Enter the time the model started and finished." unless from && to
    raise Error, "The finish time must be after the start time." unless to > from
    raise Error, "That's more than 12 hours. Check the times." if to - from > 12.hours

    @gig.update_columns(worked_starts_at: from, worked_ends_at: to, updated_at: Time.current)
    "Hours changed to #{time(from)} – #{time(to)} (booked #{time(klass.starts_at)} – #{time(klass.ends_at)})"
  end

  # Records another model covering: the booked model becomes a no-show, and the
  # stand-in gets a paid gig on the date, in free time made for the hours they
  # worked. The stand-in must be able to pose for the class and not already be on it.
  def record_cover!
    stand_in = User.find_by(id: @params[:stand_in_user_id], role: :model)
    raise Error, "Choose the model who covered." unless stand_in
    original = name_of(@gig)
    if stand_in.id == @gig.art_model_availability.user_id
      raise Error, "#{original} can't cover for themselves."
    end
    if klass.nude? && !stand_in.willing_to_model_nude
      raise Error, "#{stand_in.first_name} #{stand_in.last_name} only models clothed, and this was a nude session."
    end

    already_there = klass.confirmed_gigs.joins(:art_model_availability)
                         .exists?(art_model_availabilities: { user_id: stand_in.id })
    raise Error, "#{stand_in.first_name} #{stand_in.last_name} is already recorded on this date." if already_there

    no_show!(@gig) unless @gig.no_show

    slot = ArtModelAvailability.new(user: stand_in, starts_at: klass.starts_at, ends_at: klass.ends_at, status: :active)
    slot.recording_past = true
    slot.save!

    cover = Gig.cancelled.joins(:art_model_availability)
               .find_by(faculty_request_id: klass.id, art_model_availabilities: { user_id: stand_in.id })
    if cover
      cover.update_columns(status: Gig.statuses[:confirmed], billable: nil, no_show: false,
                           art_model_availability_id: slot.id, updated_at: Time.current)
    else
      cover = Gig.new(faculty_request: klass, art_model_availability: slot, confirmed_by: @admin,
                      model_slot_position: @gig.model_slot_position)
      cover.recording_past = true
      cover.save!
    end

    stand_in_name = "#{stand_in.first_name} #{stand_in.last_name}"
    record!(cover, "covered_by", "Covered for #{original}")
    "#{stand_in_name} covered: #{original} marked as a no-show (not paid), #{stand_in_name} paid"
  end

  # A time from the request, or nil if it isn't one.
  def parse(value)
    return nil if value.blank?
    Time.zone.parse(value.to_s)
  rescue ArgumentError
    nil
  end
end
