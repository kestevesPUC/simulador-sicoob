using Microsoft.EntityFrameworkCore;
using Sicoob.Api.Models;

namespace Sicoob.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("customers");
            entity.HasKey(customer => customer.Id);
            entity.Property(customer => customer.Id).HasColumnName("id");
            entity.Property(customer => customer.Name).HasColumnName("name").HasMaxLength(160).IsRequired();
            entity.Property(customer => customer.Email).HasColumnName("email").HasMaxLength(200).IsRequired();
            entity.Property(customer => customer.CreatedAt).HasColumnName("created_at").IsRequired();
            entity.HasIndex(customer => customer.Email).IsUnique();
        });
    }
}
