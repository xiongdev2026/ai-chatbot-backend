import { prisma } from "../database/prisma";

interface PaginationOptions {
  page?: number;
  limit?: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Applies pagination to a Prisma findMany query.
 * @param model The Prisma model to query (e.g., prisma.user).
 * @param options Pagination options (page, limit).
 * @param findManyArgs Arguments for Prisma's findMany method (where, include, orderBy, etc.).
 * @returns A paginated result.
 */
export async function paginate<T>(
  model: any, // Prisma model (e.g., prisma.user)
  options: PaginationOptions,
  findManyArgs: any = {}
): Promise<PaginatedResult<T>> {
  const page = options.page ? Math.max(1, options.page) : 1;
  const limit = options.limit ? Math.max(1, options.limit) : 10;
  const skip = (page - 1) * limit;

  const [data, total] = await prisma.$transaction([
    model.findMany({
      ...findManyArgs,
      skip,
      take: limit,
    }),
    model.count({ where: findManyArgs.where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
}
