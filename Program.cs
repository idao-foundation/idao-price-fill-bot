internal class Program
{
    private static void Main(string[] args)
    {
        var ids = idao_price_fill_bot.src.Database.BetsDatabase.GetMissingIds();
        Console.WriteLine("Missing IDs: " + string.Join(", ", ids));
    }
}