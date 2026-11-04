# One-time announcements sent through the Updates list.
namespace :announce do
  desc "Ask every current model, once, to review their profile because options have expanded"
  task profile_review: :environment do
    count = Notification.announce_profile_review!
    if count.zero?
      puts "Nothing sent: models were already asked (see History), or there are no current models."
    else
      puts "Asked #{count} model#{'s' if count != 1} to review their profile."
    end
  end
end
