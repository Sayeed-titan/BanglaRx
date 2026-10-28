using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public static class DoctorEndpoints
{
    public static void MapDoctorEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/doctors").WithTags("Doctors");

        group.MapGet("/", async (IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var doctors = await db.QueryAsync<Doctor>("SELECT * FROM doctors ORDER BY id ASC;");
            return Results.Ok(doctors);
        });

        group.MapPost("/", async (Doctor doc, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var sql = @"
                INSERT INTO doctors (name, degrees, specialization, bmdc_reg_no, hospital_name, room_no, phone, email)
                VALUES (@name, @degrees, @specialization, @bmdc_reg_no, @hospital_name, @room_no, @phone, @email)
                RETURNING id;";
            var newId = await db.QuerySingleAsync<int>(sql, doc);
            doc.id = newId;
            return Results.Ok(doc);
        });

        group.MapPut("/{id:int}", async (int id, Doctor doc, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            doc.id = id;
            var sql = @"
                UPDATE doctors SET
                    name = @name,
                    degrees = @degrees,
                    specialization = @specialization,
                    bmdc_reg_no = @bmdc_reg_no,
                    hospital_name = @hospital_name,
                    room_no = @room_no,
                    phone = @phone,
                    email = @email
                WHERE id = @id;";
            await db.ExecuteAsync(sql, doc);
            return Results.Ok(doc);
        });
    }
}
