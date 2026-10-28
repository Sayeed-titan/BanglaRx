using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using Dapper;

namespace BanglaRx.Api.Services;

public interface IDrugSafetyService
{
    Task<List<dynamic>> CheckInteractionsAsync(IEnumerable<string> genericNames);
}

public class DrugSafetyService : IDrugSafetyService
{
    private readonly IDbConnectionFactory _connectionFactory;

    public DrugSafetyService(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<List<dynamic>> CheckInteractionsAsync(IEnumerable<string> genericNames)
    {
        var cleanGenerics = genericNames
            .Where(g => !string.IsNullOrWhiteSpace(g))
            .Select(g => g.Trim().ToLowerInvariant())
            .ToList();

        if (cleanGenerics.Count < 2)
        {
            return new List<dynamic>();
        }

        using var db = _connectionFactory.CreateConnection();
        var allRules = await db.QueryAsync<DrugInteraction>("SELECT * FROM drug_interactions;");

        var warnings = new List<dynamic>();

        foreach (var rule in allRules)
        {
            var ruleA = rule.generic_a.ToLowerInvariant();
            var ruleB = rule.generic_b.ToLowerInvariant();

            bool matchA = cleanGenerics.Any(g => g.Contains(ruleA) || ruleA.Contains(g));
            bool matchB = cleanGenerics.Any(g => g.Contains(ruleB) || ruleB.Contains(g));

            if (matchA && matchB)
            {
                warnings.Add(new
                {
                    DrugA = rule.generic_a,
                    DrugB = rule.generic_b,
                    Severity = rule.severity,
                    Description = rule.description,
                    ClinicalAdvice = rule.clinical_advice
                });
            }
        }

        return warnings;
    }
}
