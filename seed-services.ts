import { AppDataSource } from "./database/data-source";
import { Service } from "./src/entities/Service";

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log("Database initialized for seeding...");

    const serviceRepo = AppDataSource.getRepository(Service);

    const services = [
      "Air Freight",
      "Ocean Freight",
      "Household Removal",
      "Office Removal",
      "General Logistics",
      "Customs Clearing",
      "Warehousing",
      "Haulage & Distribution",
    ];

    for (const name of services) {
      const exists = await serviceRepo.findOneBy({ serviceName: name });
      if (!exists) {
        await serviceRepo.save(serviceRepo.create({ serviceName: name }));
        console.log(`Seeded: ${name}`);
      }
    }

    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
