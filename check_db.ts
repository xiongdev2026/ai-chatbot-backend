import { prisma } from "./src/database/prisma";

async function main() {
  const logs = await prisma.chatLog.findMany({
    select: {
      id: true,
      question: true,
      answer: true,
      canonicalAnswer: true,
    },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(logs, null, 2));
  process.exit(0);
}

main().catch(console.error);
