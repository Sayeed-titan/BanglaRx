using Npgsql;

namespace BanglaRx.Api.Data;

public interface IDbConnectionFactory
{
    NpgsqlConnection CreateConnection();
}

public class PostgresDbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public PostgresDbConnectionFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    public NpgsqlConnection CreateConnection() => new(_connectionString);
}
