using System.Text.Json.Serialization;
using BanglaRx.Api.Data;
using BanglaRx.Api.Endpoints;
using BanglaRx.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true);

// 1. Configure JSON Options
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// 2. Configure CORS for Local & Network Frontend Clients
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// 3. HTTP Client Factory
builder.Services.AddHttpClient();

// 4. Database-First PostgreSQL Connection Factory
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Port=5432;Database=BanglaRxDB;Username=postgres;Password=123456;";
builder.Services.AddSingleton<IDbConnectionFactory>(new PostgresDbConnectionFactory(connectionString));

// 5. Clinical Application & Intelligence Services
builder.Services.AddScoped<IDrugSafetyService, DrugSafetyService>();
builder.Services.AddScoped<IConsultationAiService, ConsultationAiService>();

var app = builder.Build();

app.UseCors("AllowAll");

// 6. Database-First Schema Initialization & Seeding Validation
var dbFactory = app.Services.GetRequiredService<IDbConnectionFactory>();
await DbInitializer.EnsureDatabaseSchemaAsync(dbFactory);

// 7. Register Modular Minimal API Endpoint Groups
app.MapStatusEndpoints();
app.MapMedicineEndpoints();
app.MapDoctorEndpoints();
app.MapPatientEndpoints();
app.MapQueueEndpoints();
app.MapPrescriptionEndpoints();
app.MapInteractionEndpoints();
app.MapAiConsultationEndpoints();

app.Run("http://localhost:5000");
