# One person's calendar, in the iCalendar format that Google, Apple and Outlook
# Calendar subscribe to: a model's booked gigs, a faculty member's class dates
# (saying whether a model is booked, never who), or every booking for admins.
# Covers the last 30 days and everything still to come.
class CalendarFeed
  LOOK_BACK = 30.days

  # A feed for this person.
  def initialize(user)
    @user = user
  end

  # The whole calendar as text, with lines folded and ended the way the format asks.
  def to_ics
    lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MICA Pose Pool//EN",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:MICA Pose Pool",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"
    ]
    events.each { |event| lines.concat(vevent(**event)) }
    lines << "END:VCALENDAR"
    lines.map { |line| fold(line) }.join("\r\n") + "\r\n"
  end

  private

  # The person's events, by role.
  def events
    if @user.role_admin?
      gigs.map { |gig| gig_event(gig, summary: "#{full_name(gig.art_model_availability.user)}: #{gig.faculty_request.class_name}") }
    elsif @user.role_model?
      gigs.where(art_model_availabilities: { user_id: @user.id })
        .map { |gig| gig_event(gig, summary: "Modeling: #{gig.faculty_request.class_name}") }
    else
      class_dates.map { |date| class_event(date) }
    end
  end

  # Confirmed gigs in the feed's window.
  def gigs
    Gig.confirmed.joins(:art_model_availability, :faculty_request)
      .where("faculty_requests.starts_at > ?", LOOK_BACK.ago)
      .includes(faculty_request: :user, art_model_availability: :user)
  end

  # The faculty member's class dates in the window that aren't cancelled.
  def class_dates
    FacultyRequest.where(user_id: @user.id).where.not(status: :archived)
      .where("starts_at > ?", LOOK_BACK.ago).includes(:confirmed_gigs)
  end

  # A gig as an event: where, who teaches it, and clothed or nude.
  def gig_event(gig, summary:)
    request = gig.faculty_request
    {
      uid: "gig-#{gig.id}", summary: summary, starts_at: request.starts_at, ends_at: request.ends_at,
      location: place(request),
      description: ["Faculty: #{full_name(request.user)}", request.nude? ? "Nude" : "Clothed"].join("\n")
    }
  end

  # A class date as an event, saying how many of its models are booked.
  def class_event(date)
    booked = date.confirmed_gigs.size
    status = if booked >= date.models_needed then "model#{'s' if date.models_needed > 1} booked"
             elsif booked.zero? then "needs a model"
             else "#{booked} of #{date.models_needed} models booked"
             end
    {
      uid: "date-#{date.id}", summary: "#{date.class_name} (#{status})",
      starts_at: date.starts_at, ends_at: date.ends_at, location: place(date), description: nil
    }
  end

  # The lines of one event.
  def vevent(uid:, summary:, starts_at:, ends_at:, location:, description:)
    lines = [
      "BEGIN:VEVENT",
      "UID:#{uid}@mica-pose-pool",
      "DTSTAMP:#{stamp(Time.current)}",
      "DTSTART:#{stamp(starts_at)}",
      "DTEND:#{stamp(ends_at)}",
      "SUMMARY:#{escape(summary)}"
    ]
    lines << "LOCATION:#{escape(location)}" if location.present?
    lines << "DESCRIPTION:#{escape(description)}" if description.present?
    lines << "END:VEVENT"
  end

  # Building and room, like Fox 201.
  def place(request)
    [request.building, request.room_number].compact_blank.join(" ")
  end

  # A person's first and last name.
  def full_name(person)
    "#{person&.first_name} #{person&.last_name}".strip
  end

  # A time in UTC, as the format writes it.
  def stamp(time)
    time.utc.strftime("%Y%m%dT%H%M%SZ")
  end

  # Text with the format's special characters escaped.
  def escape(text)
    text.to_s.gsub(/\r?\n|[\\;,]/) { |match| match.end_with?("\n") ? "\\n" : "\\#{match}" }
  end

  # Splits a line longer than 75 bytes into continuation lines that start with a space.
  def fold(line)
    parts = []
    current = +""
    line.each_char do |char|
      limit = parts.empty? ? 75 : 74
      if (current + char).bytesize > limit
        parts << current
        current = +""
      end
      current << char
    end
    parts << current
    parts.join("\r\n ")
  end
end
