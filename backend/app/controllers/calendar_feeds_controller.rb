# Private calendar links. A signed-in person gets their link (or a new one, which
# stops the old one working); calendar apps fetch the feed with the link alone,
# since they can't sign in.
class CalendarFeedsController < ApplicationController
  skip_before_action :require_login, only: [:show]

  # The feed for a link's token, or not found.
  def show
    user = User.find_by(calendar_token: params[:token].to_s) if params[:token].present?
    return head :not_found unless user

    send_data CalendarFeed.new(user).to_ics,
      type: "text/calendar; charset=utf-8", disposition: "inline", filename: "mica-pose-pool.ics"
  end

  # The signed-in person's link, made the first time it's asked for.
  def link
    current_user.update_columns(calendar_token: new_token) if current_user.calendar_token.blank?
    render json: { url: feed_url }
  end

  # Replaces the signed-in person's link; the old one stops working.
  def reset
    current_user.update_columns(calendar_token: new_token)
    render json: { url: feed_url }
  end

  private

  # A new random token, long enough that it can't be guessed.
  def new_token
    SecureRandom.urlsafe_base64(24)
  end

  # The full address of the signed-in person's feed.
  def feed_url
    "#{request.base_url}/calendar/#{current_user.calendar_token}.ics"
  end
end
