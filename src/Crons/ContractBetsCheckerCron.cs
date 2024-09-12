namespace idao_price_fill_bot.src.Crons
{
    class ContractBetsCheckerCron : Cron
    {
        public override Task RunAsync()
        {
            // Check for contract bets
            return Task.CompletedTask;
        }
    }
}
