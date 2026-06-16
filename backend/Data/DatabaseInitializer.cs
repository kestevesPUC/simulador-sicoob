using Microsoft.EntityFrameworkCore;
using Sicoob.Api.Models;

namespace Sicoob.Api.Data;

public static class DatabaseInitializer
{
    public static async Task ApplyMigrationsAndSeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.MigrateAsync();
        await SeedCustomersAsync(dbContext);
    }

    private static async Task SeedCustomersAsync(AppDbContext dbContext)
    {
        if (await dbContext.Customers.AnyAsync())
        {
            return;
        }

        var createdAt = DateTime.UtcNow;
        var customers = new[]
        {
            new Customer { Name = "Ana Paula Martins", Email = "ana.martins@sicoob.com.br", CreatedAt = createdAt.AddDays(-12) },
            new Customer { Name = "Bruno Henrique Costa", Email = "bruno.costa@empresa.com.br", CreatedAt = createdAt.AddDays(-8) },
            new Customer { Name = "Carla Fernanda Lima", Email = "carla.lima@cooperado.com.br", CreatedAt = createdAt.AddDays(-4) },
            new Customer { Name = "Diego Almeida Rocha", Email = "diego.rocha@financeiro.com.br", CreatedAt = createdAt.AddDays(-1) }
        };

        dbContext.Customers.AddRange(customers);
        await dbContext.SaveChangesAsync();
    }
}
