# A person's updates about their gigs and classes.
class NotificationsController < ApplicationController
  LIST_LENGTH = 50

  # The person's latest updates, newest first, and how many are unread. Updates read
  # more than half a year ago are cleared away first.
  def index
    Notification.clear_old_for!(current_user)
    mine = current_user.notifications
    render json: {
      unread: mine.unread.count,
      notifications: mine.order(updated_at: :desc, id: :desc).limit(LIST_LENGTH)
    }
  end

  # Marks every one of the person's updates read.
  def read
    current_user.notifications.unread.update_all(read_at: Time.current)
    head :no_content
  end
end
