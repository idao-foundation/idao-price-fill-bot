using SQLite;

namespace idao_price_fill_bot.src.Database
{
    public class Bet
    {
        [PrimaryKey]
        public int Id { get; set; }
        public long ResultPrice { get; set; }
        public long CloseTimestamp { get; set; }
    }

    public static class BetsDatabase
    {
        private const string DatabasePath = "./bets.db";
        private static SQLiteConnection GetConnection()
        {
            if (!File.Exists(DatabasePath))
            {
                var connection = new SQLiteConnection(DatabasePath);
                connection.CreateTable<Bet>();
                return connection;
            }
            return new SQLiteConnection(DatabasePath);
        }

        public static void AddBet(int id, long resultPrice, long closeTimestamp)
        {
            using var connection = GetConnection();
            connection.Insert(new Bet
            {
                Id = id,
                ResultPrice = resultPrice,
                CloseTimestamp = closeTimestamp
            });
        }

        public static void SetResultPrice(int id, long resultPrice)
        {
            using var connection = GetConnection();
            connection.Update(new Bet
            {
                Id = id,
                ResultPrice = resultPrice
            });
        }

        public static IEnumerable<Bet> GetUnfilledBets()
        {
            using var connection = GetConnection();
            return connection.Table<Bet>().Where(bet => bet.ResultPrice == 0);
        }

        public static List<int> GetMissingIds()
        {
            using var connection = GetConnection();
            return connection.Query<int>(@"
                WITH RECURSIVE all_ids AS (
                    SELECT 0 AS Id
                    UNION ALL
                    SELECT Id + 1
                    FROM all_ids
                    WHERE Id < (SELECT MAX(Id) FROM Bet)
                )
                SELECT Id
                FROM all_ids
                WHERE Id NOT IN (SELECT Id FROM Bet)
                ORDER BY Id;
            ");
        }
    }
}