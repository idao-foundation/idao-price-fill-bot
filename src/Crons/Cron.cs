namespace idao_price_fill_bot.src.Crons
{
    public abstract class Cron
    {
        public abstract Task RunAsync();

        public Task StartCron(int interval)
        {
            return Task.Run(async () =>
            {
                while (true)
                {
                    await RunAsync();
                    await Task.Delay(interval);
                }
            });
        }
    }
}