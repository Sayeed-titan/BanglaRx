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
// environment variables win over the local file (the test suites point the API at a throw-away database this way)
builder.Configuration.AddEnvironmentVariables();

// 1. Configure JSON Options
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// 2. CORS. Development (no origins listed): any origin may call the API. Production: list the public address(es) under
// Cors:AllowedOrigins in appsettings.local.json and only those may. (Behind IIS the page and the API share one address, so
// the browser never sends a cross-origin call at all; the list is a second lock.)
var corsOrigins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>())
    .Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim().TrimEnd('/')).ToArray();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        if (corsOrigins.Length > 0) policy.WithOrigins(corsOrigins).AllowAnyMethod().AllowAnyHeader();
        else policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

// 2b. Sign-in and roles (ON by default; Auth:Enforce=false switches it off for private development)
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
builder.Services.AddSingleton<ReportReader>();

// 3. HTTP Client Factory
builder.Services.AddHttpClient();

// 4. Database-First PostgreSQL Connection Factory
// No built-in fallback: a password in source control is a password everyone has. Put it in appsettings.local.json (git-ignored),
// or in the ConnectionStrings__DefaultConnection environment variable.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("No database connection string. Set ConnectionStrings:DefaultConnection in appsettings.local.json (see deploy/appsettings.production.example.json) or the ConnectionStrings__DefaultConnection environment variable.");
builder.Services.AddSingleton<IDbConnectionFactory>(new PostgresDbConnectionFactory(connectionString));

// 5. Clinical Application & Intelligence Services
builder.Services.AddScoped<IDrugSafetyService, DrugSafetyService>();
builder.Services.AddScoped<IClinicalSafetyService, ClinicalSafetyService>();
builder.Services.AddScoped<IConsultationAiService, ConsultationAiService>();
builder.Services.AddScoped<SathiService>();

var app = builder.Build();

if (!app.Services.GetRequiredService<AuthOptions>().Enforce)
    app.Logger.LogWarning("Auth:Enforce is OFF: patient and prescription routes are open to anyone who can reach this port. Use only on a private development machine.");

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
await PharmacySchema.EnsureAsync(dbFactory);
await ReportSchema.EnsureAsync(dbFactory);

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
