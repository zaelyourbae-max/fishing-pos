import UserManager from "@/components/users/user-manager";
import { requireOwnerPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  await requireOwnerPage();

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  return (
    <UserManager
      users={users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }))}
    />
  );
}
