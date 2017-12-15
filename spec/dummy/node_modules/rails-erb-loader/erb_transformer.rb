require 'timeout'

delimiter, engine, timeout = ARGV
timeout = Float(timeout)

handler = case engine
  when 'erubi'
    require 'erubi'
    Erubi::Engine
  when 'erubis'
    require 'erubis'
    Erubis::Eruby
  when 'erb'
    require 'erb'
    ERB
  else raise "Unknown templating engine `#{engine}`"
end

begin
  Timeout.timeout(timeout) do
    source = STDIN.read

    if engine == 'erubi'
      puts "#{delimiter}#{eval(handler.new(source).src)}#{delimiter}"
    else
      puts "#{delimiter}#{handler.new(source).result}#{delimiter}"
    end
  end
rescue Timeout::Error
  raise "rails-erb-loader took longer than the specified #{timeout} second timeout"
end
