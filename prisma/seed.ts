// prisma/seed.ts
//
// Development/test seed data for the Hospital AI Chatbot (RAG) system.
// Run with: npx ts-node prisma/seed.ts

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, Prisma } from "../generated/prisma";
import bcrypt from "bcryptjs";
import { embedText } from "../src/utils/embeddings";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Creates a KnowledgeChunk and populates its pgvector embedding.
 * Embedding is set via raw SQL because Prisma's `Unsupported("vector")`
 * fields cannot be written through the normal Client `data` object.
 */
async function createKnowledgeChunk(
  sourceId: string,
  content: string,
  lang: string,
) {
  const chunk = await prisma.knowledgeChunk.create({
    data: { sourceId, content, lang },
  });

  try {
    const embedding = await embedText(content);
    await prisma.$executeRaw`
      UPDATE "knowledge_chunks"
      SET embedding = ${JSON.stringify(embedding)}::vector
      WHERE id = ${chunk.id}
    `;
  } catch (error) {
    console.warn(
      `  ⚠ Failed to embed knowledge chunk ${chunk.id} (${lang}):`,
      (error as Error).message,
    );
  }

  return chunk;
}

/**
 * Creates a ChatLog and populates its pgvector embedding, mirroring the
 * background-embedding step performed by chat.service.ts at runtime.
 */
async function createChatLog(data: Prisma.ChatLogUncheckedCreateInput) {
  const log = await prisma.chatLog.create({ data });

  try {
    const embedding = await embedText(data.question);
    await prisma.$executeRaw`
      UPDATE "chat_logs"
      SET embedding = ${JSON.stringify(embedding)}::vector
      WHERE id = ${log.id}
    `;
  } catch (error) {
    console.warn(
      `  ⚠ Failed to embed chat log ${log.id}:`,
      (error as Error).message,
    );
  }

  return log;
}

async function clearExistingData() {
  console.log("🧹 Clearing existing seed-managed data...");
  // Child tables first, respecting foreign key constraints.
  await prisma.surveyResponse.deleteMany({});
  await prisma.chatFeedback.deleteMany({});
  await prisma.chatLog.deleteMany({});
  await prisma.knowledgeChunk.deleteMany({});
  await prisma.knowledgeSource.deleteMany({});
  await prisma.faq.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.medicalService.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedUsers() {
  console.log("👤 Seeding users...");
  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@hospital.com",
      passwordHash,
      fullName: "System Administrator",
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`  ✔ Created admin user: ${admin.email}`);
  return admin;
}

async function seedDepartments() {
  console.log("🏥 Seeding departments...");

  const cardiology = await prisma.department.create({
    data: {
      name: "Cardiology",
      description:
        "Diagnoses and treats conditions of the heart and blood vessels, including heart disease, arrhythmia, and hypertension.",
      openingHours: "Mon-Fri 08:00-17:00",
      location: "Building A, Floor 2",
      isActive: true,
    },
  });

  const pediatrics = await prisma.department.create({
    data: {
      name: "Pediatrics",
      description:
        "Provides medical care for infants, children, and adolescents, including vaccinations and routine check-ups.",
      openingHours: "Mon-Sat 08:00-16:00",
      location: "Building B, Floor 1",
      isActive: true,
    },
  });

  console.log(`  ✔ Created ${2} departments`);
  return { cardiology, pediatrics };
}

async function seedDoctors(departments: {
  cardiology: { id: string };
  pediatrics: { id: string };
}) {
  console.log("🩺 Seeding doctors...");

  const doctors = await Promise.all([
    prisma.doctor.create({
      data: {
        fullName: "Dr. Somchai Inthavong",
        specialty: "Cardiologist",
        departmentId: departments.cardiology.id,
        bio: "Over 15 years of experience in interventional cardiology and heart disease management.",
        isActive: true,
      },
    }),
    prisma.doctor.create({
      data: {
        fullName: "Dr. Anousone Phimmasone",
        specialty: "Cardiac Surgeon",
        departmentId: departments.cardiology.id,
        bio: "Specializes in cardiac surgery, including bypass and valve repair procedures.",
        isActive: true,
      },
    }),
    prisma.doctor.create({
      data: {
        fullName: "Dr. Khamla Vongsa",
        specialty: "Pediatrician",
        departmentId: departments.pediatrics.id,
        bio: "Focused on child development, vaccinations, and general pediatric care.",
        isActive: true,
      },
    }),
  ]);

  console.log(`  ✔ Created ${doctors.length} doctors`);
  return doctors;
}

async function seedMedicalServices(departments: {
  cardiology: { id: string };
  pediatrics: { id: string };
}) {
  console.log("💉 Seeding medical services...");

  const medicalServices = await Promise.all([
    prisma.medicalService.create({
      data: {
        name: "MRI Scan",
        description:
          "Magnetic resonance imaging for detailed internal body imaging.",
        departmentId: departments.cardiology.id,
        isActive: true,
      },
    }),
    prisma.medicalService.create({
      data: {
        name: "CT Scan",
        description:
          "Computed tomography scan for cross-sectional imaging of the body.",
        departmentId: departments.cardiology.id,
        isActive: true,
      },
    }),
    prisma.medicalService.create({
      data: {
        name: "Echocardiogram",
        description:
          "Ultrasound imaging of the heart to assess its structure and function.",
        departmentId: departments.cardiology.id,
        isActive: true,
      },
    }),
    prisma.medicalService.create({
      data: {
        name: "Child Vaccination",
        description:
          "Routine immunizations for infants and children per the national schedule.",
        departmentId: departments.pediatrics.id,
        isActive: true,
      },
    }),
    prisma.medicalService.create({
      data: {
        name: "Pediatric Check-up",
        description:
          "General health check-up and growth monitoring for children.",
        departmentId: departments.pediatrics.id,
        isActive: true,
      },
    }),
  ]);

  console.log(`  ✔ Created ${medicalServices.length} medical services`);
  return medicalServices;
}

async function seedServices(adminId: string) {
  console.log("🛎️ Seeding general services...");

  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: "Health Insurance Assistance",
        shortDescription:
          "Help with understanding and filing insurance claims.",
        fullDescription:
          "Our billing office helps patients understand their insurance coverage and assists with claim submissions for both local and international insurance providers.",
        category: "GENERAL",
        isActive: true,
        createdBy: adminId,
      },
    }),
    prisma.service.create({
      data: {
        name: "Ambulance Service",
        shortDescription: "24/7 emergency ambulance dispatch.",
        fullDescription:
          "Our ambulance service operates around the clock, staffed with trained paramedics, for emergency transport to and from the hospital.",
        category: "GENERAL",
        isActive: true,
        createdBy: adminId,
      },
    }),
    prisma.service.create({
      data: {
        name: "Online Appointment Booking",
        shortDescription: "Book doctor appointments online.",
        fullDescription:
          "Patients can schedule, reschedule, or cancel appointments with any department through our online booking portal.",
        category: "TECHNICAL",
        isActive: true,
        createdBy: adminId,
      },
    }),
  ]);

  console.log(`  ✔ Created ${services.length} services`);
  return services;
}

async function seedPosts(adminId: string) {
  console.log("📰 Seeding posts...");

  const posts = await Promise.all([
    prisma.post.create({
      data: {
        title: "New MRI Machine Now Available",
        slug: "new-mri-machine-now-available",
        content:
          "We are pleased to announce the installation of a new state-of-the-art MRI machine in our Cardiology department, reducing wait times and improving imaging quality.",
        status: "PUBLISHED",
        createdBy: adminId,
      },
    }),
    prisma.post.create({
      data: {
        title: "Flu Season Prevention Tips",
        slug: "flu-season-prevention-tips",
        content:
          "As flu season approaches, we recommend annual vaccination, frequent handwashing, and avoiding close contact with sick individuals to reduce your risk of infection.",
        status: "PUBLISHED",
        createdBy: adminId,
      },
    }),
    prisma.post.create({
      data: {
        title: "Hospital Holiday Schedule",
        slug: "hospital-holiday-schedule",
        content:
          "Our outpatient departments will operate on a reduced schedule during the upcoming public holidays. Emergency services remain available 24/7.",
        status: "DRAFT",
        createdBy: adminId,
      },
    }),
  ]);

  console.log(`  ✔ Created ${posts.length} posts`);
  return posts;
}

async function seedFaqs() {
  console.log("❓ Seeding FAQs...");

  const faqs = await Promise.all([
    prisma.faq.create({
      data: {
        question: "What are the hospital's opening hours?",
        answer:
          "Our outpatient departments are generally open Monday to Friday, 08:00 to 17:00, with some departments also open on Saturdays. Emergency services are available 24/7.",
        category: "General",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "Do I need an appointment to see a doctor?",
        answer:
          "We recommend booking an appointment in advance, either online or by phone, to reduce your waiting time. Walk-ins are accepted based on availability.",
        category: "Appointments",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "What insurance do you accept?",
        answer:
          "We accept most major local and international health insurance plans. Please contact our billing office to confirm coverage for your specific plan.",
        category: "Billing",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "Where is the Cardiology department located?",
        answer: "The Cardiology department is located in Building A, Floor 2.",
        category: "Departments",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "How can I get an MRI scan?",
        answer:
          "MRI scans are available through our Cardiology department. Please book an appointment through your doctor or our online booking portal.",
        category: "Services",
        isActive: true,
      },
    }),

    // --- Lao (ພາສາລາວ) FAQs ---
    // Mirror the English FAQs so Lao questions can hit an exact FAQ match
    // (structuredSearch) instead of only falling through to semantic search.
    prisma.faq.create({
      data: {
        question: "ໂຮງໝໍເປີດໃຫ້ບໍລິການເວລາໃດ?",
        answer:
          "ພະແນກຄົນເຈັບນອກຂອງພວກເຮົາເປີດ ວັນຈັນ ຫາ ວັນສຸກ ເວລາ 08:00 ຫາ 17:00 ໂມງ, ບາງພະແນກເປີດວັນເສົາ. ບໍລິການສຸກເສີນເປີດຕະຫຼອດ 24 ຊົ່ວໂມງ.",
        category: "General",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "ຂ້ອຍຕ້ອງນັດໝາຍລ່ວງໜ້າກ່ອນພົບແພດບໍ?",
        answer:
          "ພວກເຮົາແນະນຳໃຫ້ນັດໝາຍລ່ວງໜ້າ ຜ່ານທາງອອນລາຍ ຫຼື ໂທລະສັບ ເພື່ອຫຼຸດເວລາລໍຖ້າ. ຮັບຄົນເຈັບ Walk-in ຕາມຄິວທີ່ຫວ່າງ.",
        category: "Appointments",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "ໂຮງໝໍຮັບປະກັນສຸຂະພາບປະເພດໃດແດ່?",
        answer:
          "ພວກເຮົາຮັບປະກັນສຸຂະພາບທັງພາຍໃນ ແລະ ຕ່າງປະເທດ ເກືອບທຸກປະເພດ. ກະລຸນາຕິດຕໍ່ຫ້ອງການເກັບເງິນ ເພື່ອກວດສອບສິດທິຂອງທ່ານ.",
        category: "Billing",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "ພະແນກຫົວໃຈ ຕັ້ງຢູ່ໃສ?",
        answer: "ພະແນກຫົວໃຈ ຕັ້ງຢູ່ອາຄານ A ຊັ້ນ 2.",
        category: "Departments",
        isActive: true,
      },
    }),
    prisma.faq.create({
      data: {
        question: "ຂ້ອຍຈະຂໍກວດ MRI ໄດ້ແນວໃດ?",
        answer:
          "ການກວດ MRI ໃຫ້ບໍລິການຜ່ານພະແນກຫົວໃຈ. ກະລຸນານັດໝາຍຜ່ານແພດຂອງທ່ານ ຫຼື ລະບົບຈອງອອນລາຍ.",
        category: "Services",
        isActive: true,
      },
    }),
  ]);

  console.log(`  ✔ Created ${faqs.length} FAQs`);
  return faqs;
}

// Each entry becomes one KnowledgeSource plus one embedded chunk per language.
// Storing the same fact in EN/LO/TH lets pgvector semantic search match a user's
// question regardless of the language they ask in — this KB is the only
// semantically-searched source, so it is where multilingual coverage matters most.
const KNOWLEDGE_BASE: {
  title: string;
  category: string;
  chunks: { en: string; lo: string; th: string };
}[] = [
  {
    title: "Hospital General Information",
    category: "GENERAL",
    chunks: {
      en: "Our hospital is open Monday to Friday from 08:00 to 17:00, and Saturday from 08:00 to 12:00. Emergency services are available 24 hours a day, 7 days a week.",
      lo: "ໂຮງໝໍຂອງພວກເຮົາເປີດໃຫ້ບໍລິການ ວັນຈັນ ຫາ ວັນສຸກ ເວລາ 08:00 ຫາ 17:00 ໂມງ, ແລະ ວັນເສົາ ເວລາ 08:00 ຫາ 12:00 ໂມງ. ບໍລິການສຸກເສີນເປີດຕະຫຼອດ 24 ຊົ່ວໂມງ ທຸກມື້.",
      th: "โรงพยาบาลของเราเปิดให้บริการวันจันทร์ถึงวันศุกร์ เวลา 08:00 ถึง 17:00 น. และวันเสาร์ เวลา 08:00 ถึง 12:00 น. บริการฉุกเฉินเปิดตลอด 24 ชั่วโมงทุกวัน",
    },
  },
  {
    title: "Cardiology Department Guide",
    category: "MEDICAL",
    chunks: {
      en: "The Cardiology department, located in Building A Floor 2, offers MRI scans, CT scans, and echocardiograms for diagnosing heart and blood vessel conditions.",
      lo: "ພະແນກຫົວໃຈ ຕັ້ງຢູ່ອາຄານ A ຊັ້ນ 2, ໃຫ້ບໍລິການກວດ MRI, CT Scan, ແລະ ກວດຄື້ນສຽງສະທ້ອນຫົວໃຈ ສຳລັບການວິນິດໄສພະຍາດຫົວໃຈ ແລະ ເສັ້ນເລືອດ.",
      th: "แผนกโรคหัวใจ ตั้งอยู่ที่อาคาร A ชั้น 2 ให้บริการตรวจ MRI, CT Scan และตรวจคลื่นเสียงสะท้อนหัวใจ เพื่อวินิจฉัยโรคหัวใจและหลอดเลือด",
    },
  },
  {
    title: "Appointments and Billing",
    category: "GENERAL",
    chunks: {
      en: "Patients can book appointments online or by phone. Walk-ins are accepted based on availability. We accept most local and international health insurance plans; contact our billing office to confirm your coverage.",
      lo: "ຄົນເຈັບສາມາດຈອງນັດໝາຍຜ່ານທາງອອນລາຍ ຫຼື ໂທລະສັບ. ຮັບຄົນເຈັບ Walk-in ຕາມຄິວທີ່ຫວ່າງ. ພວກເຮົາຮັບປະກັນສຸຂະພາບທັງພາຍໃນ ແລະ ຕ່າງປະເທດ ເກືອບທຸກປະເພດ; ຕິດຕໍ່ຫ້ອງການເກັບເງິນເພື່ອກວດສອບສິດທິຂອງທ່ານ.",
      th: "ผู้ป่วยสามารถจองนัดหมายผ่านออนไลน์หรือโทรศัพท์ รับผู้ป่วย Walk-in ตามคิวที่ว่าง เรารับประกันสุขภาพทั้งในและต่างประเทศเกือบทุกประเภท ติดต่อแผนกการเงินเพื่อตรวจสอบสิทธิ์",
    },
  },
  {
    title: "Doctors and Specialists",
    category: "MEDICAL",
    chunks: {
      en: "Our Cardiology department includes Dr. Somchai Inthavong, a cardiologist with over 15 years of experience, and Dr. Anousone Phimmasone, a cardiac surgeon. Pediatric care is provided by Dr. Khamla Vongsa.",
      lo: "ພະແນກຫົວໃຈຂອງພວກເຮົາມີ ທ່ານໝໍ ສົມໄຊ ອິນທະວົງ ຊ່ຽວຊານດ້ານຫົວໃຈ ທີ່ມີປະສົບການຫຼາຍກວ່າ 15 ປີ, ແລະ ທ່ານໝໍ ອານຸສອນ ພິມມະສອນ ຜ່າຕັດຫົວໃຈ. ການດູແລເດັກນ້ອຍ ໂດຍ ທ່ານໝໍ ຄຳຫຼ້າ ວົງສາ.",
      th: "แผนกโรคหัวใจของเรามี นพ. สมชาย อินทะวงศ์ แพทย์โรคหัวใจ ประสบการณ์กว่า 15 ปี และ นพ. อานุสอน พิมมะสอน ศัลยแพทย์หัวใจ ส่วนการดูแลเด็กโดย นพ. คำหล้า วงศา",
    },
  },
  {
    title: "Emergency and Ambulance",
    category: "GENERAL",
    chunks: {
      en: "Emergency services are available 24 hours a day, 7 days a week. Our ambulance service operates around the clock with trained paramedics for emergency transport to and from the hospital.",
      lo: "ບໍລິການສຸກເສີນເປີດຕະຫຼອດ 24 ຊົ່ວໂມງ ທຸກມື້. ບໍລິການລົດໂຮງໝໍ (ລົດພະຍາບານ) ໃຫ້ບໍລິການຕະຫຼອດ 24 ຊົ່ວໂມງ ພ້ອມທີມແພດສຸກເສີນ ສຳລັບການຮັບສົ່ງຄົນເຈັບສຸກເສີນ.",
      th: "บริการฉุกเฉินเปิดตลอด 24 ชั่วโมงทุกวัน บริการรถพยาบาลให้บริการตลอด 24 ชั่วโมงพร้อมทีมแพทย์ฉุกเฉินสำหรับการรับส่งผู้ป่วยฉุกเฉิน",
    },
  },
  {
    title: "Pediatrics Department Guide",
    category: "MEDICAL",
    chunks: {
      en: "The Pediatrics department in Building B, Floor 1 provides child vaccinations, routine check-ups, and growth monitoring for infants, children, and adolescents.",
      lo: "ພະແນກເດັກ ຢູ່ອາຄານ B ຊັ້ນ 1 ໃຫ້ບໍລິການສັກຢາກັນພະຍາດເດັກ, ກວດສຸຂະພາບປະຈຳ, ແລະ ຕິດຕາມການເຕີບໂຕ ສຳລັບເດັກແດງ, ເດັກນ້ອຍ ແລະ ໄວລຸ້ນ.",
      th: "แผนกกุมารเวชกรรม อาคาร B ชั้น 1 ให้บริการฉีดวัคซีนเด็ก ตรวจสุขภาพประจำ และติดตามการเจริญเติบโตสำหรับทารก เด็ก และวัยรุ่น",
    },
  },
];

async function seedKnowledgeBase() {
  console.log(
    "📚 Seeding knowledge base (multilingual EN/LO/TH, with embeddings)...",
  );

  const sources: Record<string, { id: string }> = {};
  let chunkCount = 0;

  for (const entry of KNOWLEDGE_BASE) {
    const source = await prisma.knowledgeSource.create({
      data: {
        sourceType: "DOCUMENT",
        title: entry.title,
        category: entry.category,
        isActive: true,
      },
    });
    sources[entry.title] = source;

    await createKnowledgeChunk(source.id, entry.chunks.en, "en");
    await createKnowledgeChunk(source.id, entry.chunks.lo, "lo");
    await createKnowledgeChunk(source.id, entry.chunks.th, "th");
    chunkCount += 3;
  }

  console.log(
    `  ✔ Created ${KNOWLEDGE_BASE.length} knowledge sources with ${chunkCount} embedded chunks`,
  );
  return sources;
}

async function seedChatLogs(adminId: string) {
  console.log("💬 Seeding chat logs...");

  const log1 = await createChatLog({
    sessionId: crypto.randomUUID(),
    question: "What time does the hospital open?",
    answer:
      "Our hospital is open Monday to Friday from 08:00 to 17:00, and Saturday from 08:00 to 12:00. Emergency services are available 24/7.",
    confidenceScore: 0.95,
    modelUsed: "gemini-2.5-flash",
    retrievedChunks: [
      {
        sourceType: "KnowledgeChunk",
        sourceTitle: "Hospital General Information",
        similarity: 0.95,
      },
    ],
  });

  const log2 = await createChatLog({
    sessionId: crypto.randomUUID(),
    userId: adminId,
    question: "Who are the cardiologists at this hospital?",
    answer:
      "Dr. Somchai Inthavong (Cardiologist) and Dr. Anousone Phimmasone (Cardiac Surgeon) both practice in our Cardiology department, located in Building A, Floor 2.",
    confidenceScore: 0.9,
    modelUsed: "gemini-2.5-flash",
    retrievedChunks: [
      {
        sourceType: "Doctor",
        sourceTitle: "Dr. Somchai Inthavong",
        similarity: 0.95,
      },
      {
        sourceType: "Doctor",
        sourceTitle: "Dr. Anousone Phimmasone",
        similarity: 0.95,
      },
    ],
  });

  console.log("  ✔ Created 2 chat logs");

  console.log("⭐ Seeding chat feedback...");
  await prisma.chatFeedback.create({
    data: {
      chatId: log1.id,
      userId: adminId,
      rating: 5,
      comment: "Quick and accurate answer, thank you!",
    },
  });

  console.log("  ✔ Created 1 chat feedback entry");
  return { log1, log2 };
}

async function seedSurveyResponses(adminId: string) {
  console.log("⭐ Seeding survey responses...");

  const sampleFeedbacks = [
    { likedMost: "ຕອບຄຳຖາມໄວ ແລະ ຈະແຈ້ງດີຫຼາຍ", improvement: "ຢາກໃຫ້ເພີ່ມຂໍ້ມູນເວລາເປີດ-ປິດ ຂອງແຕ່ລະແຜນກໃຫ້ລະອຽດຕື່ມ" },
    { likedMost: "ໃຊ້ງານງ່າຍ ສະດວກ ບໍ່ຍຸ່ງຍາກ", improvement: "" },
    { likedMost: "ໃຫ້ຂໍ້ມູນກ່ຽວກັບທ່ານໝໍ ແລະ ແຜນກປິ່ນປົວໄດ້ກົງຕາມຕ້ອງການ", improvement: "ບາງຄຳຖາມທີ່ຍາວເກີນໄປ chatbot ອາດຈະຕອບຊ້າໜ້ອຍໜຶ່ງ" },
    { likedMost: "ລະບົບຕອບສະໜອງໄວ ດີຫຼາຍ", improvement: "ຢາກໃຫ້ມີເມນູລັດໃຫ້ເລືອກຫຼາຍກວ່ານີ້" },
    { likedMost: "ຊ່ວຍປະຢັດເວລາໃນການສອບຖາມຂໍ້ມູນໂຮງໝໍ", improvement: "" },
  ];

  const now = new Date();
  const responsesData = [];

  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const baseRating = i % 5 === 0 ? 3 : i % 8 === 0 ? 2 : i % 2 === 0 ? 5 : 4;
    const getRandomScore = (base: number) =>
      Math.min(5, Math.max(1, base + (Math.random() > 0.7 ? 1 : Math.random() < 0.2 ? -1 : 0)));

    const fb = sampleFeedbacks[i % sampleFeedbacks.length];

    responsesData.push({
      sessionId: `session-seed-${i + 1}`,
      userId: i % 3 === 0 ? adminId : null,
      q1Overall: getRandomScore(baseRating),
      q2EaseOfUse: getRandomScore(baseRating),
      q3Speed: getRandomScore(baseRating),
      q4Accuracy: getRandomScore(baseRating),
      q5Understanding: getRandomScore(baseRating),
      q6Clarity: getRandomScore(baseRating),
      q7Helpfulness: getRandomScore(baseRating),
      q8Utility: getRandomScore(baseRating),
      q9ReuseIntent: getRandomScore(baseRating),
      q10Nps: getRandomScore(baseRating),
      likedMost: i % 2 === 0 ? fb.likedMost : null,
      improvement: i % 3 === 0 ? fb.improvement : null,
      createdAt,
    });
  }

  for (const data of responsesData) {
    await prisma.surveyResponse.create({ data });
  }

  console.log(`  ✔ Created ${responsesData.length} survey responses`);
}

async function main() {
  console.log("🌱 Starting database seed...\n");

  await clearExistingData();

  const admin = await seedUsers();
  const departments = await seedDepartments();
  await seedDoctors(departments);
  await seedMedicalServices(departments);
  await seedServices(admin.id);
  await seedPosts(admin.id);
  await seedFaqs();
  await seedKnowledgeBase();
  await seedChatLogs(admin.id);
  await seedSurveyResponses(admin.id);

  console.log("\n✅ Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
