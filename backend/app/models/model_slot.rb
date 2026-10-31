# One model's preferences in a class that asks for several models with different
# preferences. Position 1 is Model 1, and so on.
class ModelSlot < ApplicationRecord
  belongs_to :request_series

  before_validation :normalize_preferences

  validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 },
                       uniqueness: { scope: :request_series_id }
  validates :pref_skin_tone, inclusion: { in: User::SKIN_TONES + ["Any"] }
  validates :pref_gender,    inclusion: { in: User::GENDER_IDENTITIES + ["Any"] }
  validates :pref_body_type, inclusion: { in: User::BODY_TYPES + ["Any"] }
  validates :pref_genitalia, inclusion: { in: User::GENITALIA + ["Any"] }

  # How many of this spot's preferences the model matches (genitalia only counts for nude classes).
  def match_score(user, nude:)
    score = 0
    score += 1 if user.skin_tone == pref_skin_tone
    score += 1 if user.gender_identity == pref_gender
    score += 1 if user.body_type.present? && user.body_type == pref_body_type
    score += 1 if nude && user.genitalia.present? && user.genitalia == pref_genitalia
    score
  end

  private

  # Blank preferences mean Any; genitalia only applies to nude classes.
  def normalize_preferences
    %w[pref_skin_tone pref_gender pref_body_type pref_genitalia].each { |pref| self[pref] = "Any" if self[pref].blank? }
    self.pref_genitalia = "Any" unless request_series&.model_mode == "nude"
  end
end
