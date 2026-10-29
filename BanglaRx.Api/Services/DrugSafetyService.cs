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
        // Each prescribed drug -> its exact active-ingredient components (combination drugs have several)
        var drugs = genericNames.Select(GenericNames.Components).Where(c => c.Count > 0).ToList();
        if (drugs.Count < 2) return new List<dynamic>();

        using var db = _connectionFactory.CreateConnection();
        var allRules = await db.QueryAsync<DrugInteraction>("SELECT * FROM drug_interactions;");

        var warnings = new List<dynamic>();
        foreach (var rule in allRules)
        {
            var a = GenericNames.Components(rule.generic_a);
            var b = GenericNames.Components(rule.generic_b);

            // Exact component equality; the two sides must come from two DIFFERENT prescribed drugs
            for (int i = 0; i < drugs.Count; i++)
            {
                for (int j = 0; j < drugs.Count; j++)
                {
                    if (i == j) continue;
                    if (drugs[i].Any(a.Contains) && drugs[j].Any(b.Contains))
                    {
                        warnings.Add(new
                        {
                            DrugA = rule.generic_a,
                            DrugB = rule.generic_b,
                            Severity = rule.severity,
                            Description = rule.description,
                            ClinicalAdvice = rule.clinical_advice
                        });
                        goto nextRule;
                    }
                }
            }
            nextRule:;
        }

        return warnings;
    }
}
