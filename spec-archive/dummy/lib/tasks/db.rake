namespace :db do
  desc 'Load seed data from db/seeds.rb'
  task seed: [:environment] do
    seed_file = File.join(Rails.root, 'db', 'seeds.rb')
    load seed_file if File.exist?(seed_file)
  end
end
