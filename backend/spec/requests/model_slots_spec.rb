require "rails_helper"

RSpec.describe "Per-model preferences", type: :request do
  let(:faculty)   { create(:user) }
  let(:admin)     { create(:user, :admin) }
  let(:next_week) { 7.days.from_now.to_date.iso8601 }
  let(:muscular)  { { pref_skin_tone: "Any", pref_gender: "Any", pref_body_type: "Muscular", pref_genitalia: "Any" } }
  let(:fat)       { muscular.merge(pref_body_type: "Fat") }

  def create_series(model_slots:, models_needed: 2)
    post "/request_series",
      params: {
        request_series: { class_name: "Group Pose Lab", department: "Drawing", building: "Main",
                          model_mode: "clothed", models_needed: models_needed },
        dates: [{ date: next_week, start_time: "10:00", end_time: "12:00" }],
        model_slots: model_slots
      },
      headers: auth_headers(faculty), as: :json
  end

  def update_series(series, changes, model_slots: nil, as: faculty)
    body = { request_series: changes }
    body[:model_slots] = model_slots unless model_slots.nil?
    patch "/request_series/#{series.id}", params: body, headers: auth_headers(as), as: :json
  end

  it "saves one set of preferences per model, in order" do
    create_series(model_slots: [muscular, fat])
    expect(response).to have_http_status(:created)
    expect(RequestSeries.last.model_slots.map(&:pref_body_type)).to eq(%w[Muscular Fat])
  end

  it "needs one set for each model" do
    expect { create_series(model_slots: [muscular]) }.not_to change(RequestSeries, :count)
    expect(response.parsed_body["error"]).to include("each of the 2 models")
  end

  it "keeps working without per-model preferences" do
    create_series(model_slots: [])
    expect(response).to have_http_status(:created)
    expect(RequestSeries.last.model_slots).to be_empty
  end

  it "lets Edit Class replace them, or switch back to the same for every model" do
    create_series(model_slots: [muscular, fat])
    series = RequestSeries.last

    update_series(series, { notes: "swap" }, model_slots: [fat, muscular])
    expect(series.model_slots.reload.map(&:pref_body_type)).to eq(%w[Fat Muscular])

    update_series(series, { notes: "same" }, model_slots: [])
    expect(series.model_slots.reload).to be_empty
  end

  it "grows or shrinks the list when an admin changes the number of models" do
    create_series(model_slots: [muscular, fat])
    series = RequestSeries.last

    update_series(series, { models_needed: 3 }, as: admin)
    expect(series.model_slots.reload.map(&:pref_body_type)).to eq(%w[Muscular Fat Any])

    update_series(series, { models_needed: 1 }, as: admin)
    expect(series.model_slots.reload.map(&:pref_body_type)).to eq(%w[Muscular])
  end

  it "includes them when listing classes" do
    create_series(model_slots: [muscular, fat])
    get "/request_series", headers: auth_headers(faculty)
    slots = response.parsed_body.first["model_slots"]
    expect(slots.map { |s| s["pref_body_type"] }).to eq(%w[Muscular Fat])
  end
end