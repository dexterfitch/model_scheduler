# Who hears about each change to a gig or class, as an update in the app. Nobody is
# told about a change they made themselves, and a failure here never undoes the
# change: it's logged instead.
class Notifier
  # A model was booked: tells the model, and the faculty member that a model is booked.
  def self.booked(gig, actor:)
    request = gig.faculty_request
    tell(gig.art_model_availability.user, "booked", request, actor: actor)
    tell(owner_of(request), "class_booked", request, actor: actor)
  end

  # The confirmed gigs on these class dates, to compare with after a change.
  def self.confirmed_gigs_on(requests)
    Gig.confirmed.where(faculty_request: requests)
      .includes(faculty_request: { request_series: :user }, art_model_availability: :user).to_a
  end

  # A model's confirmed gigs, to compare with after they or an admin cancel some.
  def self.confirmed_gigs_of(user_id)
    Gig.confirmed.joins(:art_model_availability)
      .where(art_model_availabilities: { user_id: user_id })
      .includes(faculty_request: { request_series: :user }, art_model_availability: :user).to_a
  end

  # The gigs from the list that a change has since cancelled.
  def self.now_cancelled(gigs)
    gigs.each(&:reload).select(&:cancelled?)
  end

  # An admin took models off dates: tells each model, and whether they're still paid.
  def self.released(gigs, actor:)
    gigs.each do |gig|
      tell(gig.art_model_availability.user, "released", gig.faculty_request, actor: actor, paid: gig.billable)
    end
  end

  # Class dates were cancelled: tells the models who were booked on them, and the
  # faculty member when someone else did the cancelling.
  def self.dates_cancelled(requests, gigs, actor:)
    gigs.each do |gig|
      tell(gig.art_model_availability.user, "date_cancelled", gig.faculty_request, actor: actor, paid: gig.billable)
    end
    requests.each { |request| tell(owner_of(request), "class_cancelled", request, actor: actor) }
  end

  # A model cancelled their own gigs: tells every admin who it was, and the faculty
  # member that their model cancelled (without saying who).
  def self.dropped_out(gigs, actor:)
    admins = User.role_admin.to_a
    gigs.each do |gig|
      model = gig.art_model_availability.user
      name = "#{model.first_name} #{model.last_name}"
      admins.each { |admin| tell(admin, "dropped_out", gig.faculty_request, actor: actor, about: name) }
      tell(owner_of(gig.faculty_request), "model_cancelled", gig.faculty_request, actor: actor)
    end
  end

  # A date's time changed: tells the booked models and the faculty member the new time.
  def self.date_moved(request, actor:)
    confirmed_gigs_on(request).each do |gig|
      tell(gig.art_model_availability.user, "date_moved", request, actor: actor)
    end
    tell(owner_of(request), "class_date_moved", request, actor: actor)
  end

  # A date was added to a class: tells the faculty member, when someone else added it.
  def self.date_added(request, actor:)
    tell(owner_of(request), "class_date_added", request, actor: actor)
  end

  # A class's details changed: tells the faculty member what changed, when someone
  # else changed it. The update is listed under the class's next date.
  def self.class_edited(series, changes, actor:)
    date = series.faculty_requests.where.not(status: :archived).order(:starts_at).first ||
      series.faculty_requests.order(:starts_at).last
    tell(series.user, "class_edited", date, actor: actor, about: changes.truncate(250)) if date
  end

  # The faculty member a class date belongs to.
  def self.owner_of(request)
    request.request_series&.user || request.user
  end

  # Adds one update for one person, unless they made the change themselves.
  def self.tell(user, kind, request, actor:, paid: nil, about: nil)
    return if user.nil? || user == actor

    Notification.add!(user: user, kind: kind, request: request, paid: paid, about: about)
  rescue StandardError => e
    Rails.logger.error("Update not saved (#{kind}): #{e.class}: #{e.message}")
  end

  private_class_method :owner_of, :tell
end
