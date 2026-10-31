# One change an admin made to the record of a gig after its class happened: what
# kind, a summary in words, an optional note, who made it and when.
class GigCorrection < ApplicationRecord
  KINDS = %w[no_show undo_no_show paid unpaid hours covered_by].freeze

  belongs_to :gig
  belongs_to :user

  validates :kind, inclusion: { in: KINDS }
  validates :summary, presence: true

  # The correction with the admin's name; admins are the only ones who see these.
  def as_json(_options = {})
    serializable_hash(only: [:id, :kind, :summary, :note, :created_at],
                      include: { user: { only: [:first_name, :last_name] } })
  end
end
