// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Example seed data - you can modify or remove this based on your needs
  const testUser = await prisma.user.upsert({
    where: { twitterId: 'seed_test_user' },
    update: {},
    create: {
      twitterId: 'seed_test_user',
      username: 'tester',
      name: 'Test User',
      profileImgUrl: 'https://via.placeholder.com/400',
      accessToken: 'example_access_token',
      refreshToken: 'example_refresh_token',
      tokenExpiresAt: BigInt(Date.now() + 3600000), // 1 hour from now
    },
  });

  console.log('Seeded test user:', testUser);

  // Add some example user actions
  await prisma.userAction.createMany({
    data: [
      {
        userId: testUser.id,
        tweetId: '1234567890',
        action: 'like',
        success: true,
      },
      {
        userId: testUser.id,
        tweetId: '0987654321',
        action: 'retweet',
        success: true,
      },
      {
        userId: testUser.id,
        tweetId: '5678901234',
        action: 'like',
        success: false,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seeded example user actions');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
