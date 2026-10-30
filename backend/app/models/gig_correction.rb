# One change an admin made to the record of a gig after its class happened
class GigCorrection < ApplicationRecord
  KINDS = %w[no_show undo_no_show paid unpaid hours covered_by].freeze

  belongs_to :gig
  belongs_to :user

  validates :kind, inclusion: { in: KINDS }
  validates :summary, presence: true

  def as_json(_options = {})
    serializable_hash(only: [:id, :kind, :summary, :note, :created_at],
                      include: { user: { only: [:first_name, :last_name] } })
  end
end
