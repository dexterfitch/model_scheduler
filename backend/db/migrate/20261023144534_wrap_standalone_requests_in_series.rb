# One-time cleanup: requests made before series existed get a series of their
# own, so they appear on My Classes, Requests and the dashboard.
class WrapStandaloneRequestsInSeries < ActiveRecord::Migration[8.0]
  def up
    FacultyRequest.reset_column_information
    RequestSeries.reset_column_information
    FacultyRequest.wrap_standalone_requests_in_series!
  end

  def down
    # Nothing to undo: a request in its own series behaves the same as before
  end
end