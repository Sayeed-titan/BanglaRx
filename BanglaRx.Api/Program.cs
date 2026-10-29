using System.Text.Json.Serialization;
using BanglaRx.Api.Auth;
using BanglaRx.Api.Booking;
using BanglaRx.Api.Data;
using BanglaRx.Api.PatientApp;
using BanglaRx.Api.Rubina;
using BanglaRx.Api.Endpoints;
using BanglaRx.Api.Services;

// Dapper: map snake_case columns (brand_name) onto PascalCase properties (BrandName)
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

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

// 2b. Sign-in and roles (switched off unless Auth:Enforce is true)
builder.AddBanglaRxAuth();

// 2c. Booking rules (clinic clock, lead time, how far ahead people may book)
var bookingOptions = new BookingOptions();
builder.Configuration.GetSection("Booking").Bind(bookingOptions);
builder.Services.AddSingleton(bookingOptions);
builder.Services.AddSingleton<ClinicClock>();

// 2d. Patient sign-in by phone code. SMS goes out through: log (development), http (a gateway you configure), test (tests only).
var patientOptions = new PatientOptions();
builder.Configuration.GetSection("Patient").Bind(patientOptions);
var smsOptions = new SmsOptions();
builder.Configuration.GetSection("Sms").Bind(smsOptions);
builder.Services.AddSingleton(patientOptions);
builder.Services.AddSingleton(smsOptions);
switch (smsOptions.Provider.ToLowerInvariant())
{
    case "http": builder.Services.AddSingleton<ISmsSender, HttpSmsSender>(); break;
    case "test": builder.Services.AddSingleton<ISmsSender, TestSmsSender>(); break;
    case "demo": builder.Services.AddSingleton<ISmsSender, DemoSmsSender>(); break;
    default: builder.Services.AddSingleton<ISmsSender, LogSmsSender>(); break;
}
builder.Services.AddSingleton<PatientAuthService>();

// 2e. Rubina, the public booking helper (limits live in the Rubina section of settings)
var rubinaOptions = new RubinaOptions();
builder.Configuration.GetSection("Rubina").Bind(rubinaOptions);
builder.Services.AddSingleton(rubinaOptions);
builder.Services.AddSingleton<RubinaService>();

// 3. HTTP Client Factory
builder.Services.AddHttpClient();

// 4. Database-First PostgreSQL Connection Factory
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Port=5432;Database=BanglaRxDB;Username=postgres;Password=123456;";
builder.Services.AddSingleton<IDbConnectionFactory>(new PostgresDbConnectionFactory(connectionString));

// 5. Clinical Application & Intelligence Services
builder.Services.AddScoped<IDrugSafetyService, DrugSafetyService>();
builder.Services.AddScoped<IClinicalSafetyService, ClinicalSafetyService>();
builder.Services.AddScoped<IConsultationAiService, ConsultationAiService>();
builder.Services.AddScoped<SathiService>();

var app = builder.Build();

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseMiddleware<RoleGuardMiddleware>();

// 6. Database-First Schema Initialization & Seeding Validation
var dbFactory = app.Services.GetRequiredService<IDbConnectionFactory>();
await DbInitializer.EnsureDatabaseSchemaAsync(dbFactory);
await ScheduleSchema.EnsureAsync(dbFactory);
await app.InitBanglaRxAuthAsync();
await BookingSchema.EnsureAsync(dbFactory);
await PatientSchema.EnsureAsync(dbFactory);
await RubinaSchema.EnsureAsync(dbFactory);

// 7. Register Modular Minimal API Endpoint Groups
app.MapStatusEndpoints();
app.MapMedicineEndpoints();
app.MapDoctorEndpoints();
app.MapPatientEndpoints();
app.MapQueueEndpoints();
app.MapPrescriptionEndpoints();
app.MapTemplateEndpoints();
app.MapInteractionEndpoints();
app.MapAiConsultationEndpoints();
app.MapSathiEndpoints();
app.MapScheduleEndpoints();
app.MapAuthEndpoints();
app.MapPharmacyEndpoints();
app.MapBookingEndpoints();
app.MapPatientAppEndpoints();
app.MapRubinaEndpoints();
if (smsOptions.Provider.Equals("test", StringComparison.OrdinalIgnoreCase))
    // tests only: lets a test read the code it asked for. Exists only when Sms:Provider is "test".
    app.MapGet("/api/_test/sms", (string phone) => TestSmsSender.Last.TryGetValue(phone, out var m) ? Results.Ok(new { message = m }) : Results.NotFound());

// ASPNETCORE_URLS / --urls can override the address (the API tests use another port); the default is unchanged
app.Run(builder.Configuration["urls"] ?? builder.Configuration["ASPNETCORE_URLS"] ?? "http://localhost:5000");
