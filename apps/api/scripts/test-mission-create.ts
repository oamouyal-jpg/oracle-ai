import { prisma } from "../src/lib/prisma.js";

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No user — run db:seed");
    process.exit(1);
  }
  try {
    const m = await prisma.mission.create({
      data: {
        userId: user.id,
        title: "CLI test mission",
        blockers: [],
        risks: [],
        nextActions: [],
      },
    });
    console.log("CREATE_OK", m.id);
    await prisma.mission.delete({ where: { id: m.id } });
  } catch (e) {
    console.error("CREATE_FAIL", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
