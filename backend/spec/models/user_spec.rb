require 'rails_helper'

RSpec.describe User, type: :model do
  # Validations
  describe 'validations' do
    subject { build(:user) }

    it { should validate_presence_of(:first_name) }
    it { should validate_presence_of(:last_name) }
    it { should validate_presence_of(:email) }
    it { should validate_uniqueness_of(:email).case_insensitive }

    it 'requires a MICA email address' do
      user = build(:user, email: 'test@gmail.com')
      expect(user).not_to be_valid
      expect(user.errors[:email]).to include('must be a MICA email address')
    end

    it 'accepts a valid MICA email' do
      user = build(:user, email: 'valid@mica.edu')
      expect(user).to be_valid
    end
  end

  # Model role validations
  describe 'model role validations' do
    it 'requires skin_tone for models' do
      user = build(:user, :model, skin_tone: nil)
      expect(user).not_to be_valid
    end

    it 'requires gender_identity for models' do
      user = build(:user, :model, gender_identity: nil)
      expect(user).not_to be_valid
    end

    it 'does not require model fields for faculty' do
      user = build(:user, :faculty)
      expect(user).to be_valid
    end
  end

  # Associations
  describe 'associations' do
    it { should have_many(:art_model_availabilities).dependent(:destroy) }
    it { should have_many(:faculty_requests).dependent(:destroy) }
  end

  # from_omniauth
  describe '.from_omniauth' do
    let(:auth) do
      double('auth', info: double('info',
        email: 'new@mica.edu',
        first_name: 'New',
        last_name: 'User',
        image: 'http://example.com/photo.jpg'
      ))
    end

    it 'initializes a new user without saving if one does not exist' do
      user = User.from_omniauth(auth)
      expect(user).to be_new_record
      expect(user.email).to eq('new@mica.edu')
    end

    it 'returns existing user if email matches' do
      existing = create(:user, email: 'new@mica.edu')
      user = User.from_omniauth(auth)
      expect(user.id).to eq(existing.id)
    end

    it 'updates first and last name from auth' do
      user = User.from_omniauth(auth)
      expect(user.first_name).to eq('New')
      expect(user.last_name).to eq('User')
    end
  end
end