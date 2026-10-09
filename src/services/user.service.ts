import { prisma } from "../database/prisma";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcryptjs";
import { paginate } from "../utils/pagination";
import { Role, User } from "../../generated/prisma/client";
import { PaginatedResult } from "../types/pagination";

interface CreateUserPayload {
  email: string;
  password?: string; // Password can be optional if user is created by admin and password set later
  fullName?: string;
  role?: Role;
  isActive?: boolean;
}

interface UpdateUserPayload {
  email?: string;
  password?: string;
  fullName?: string;
  role?: Role;
  isActive?: boolean;
}

class UserService {
  /**
   * Retrieves all users, optionally filtered by role, active status, or search term, with pagination.
   * @param role Optional role to filter users.
   * @param isActive Optional boolean to filter users by active status.
   * @param search Optional search term for email or full name.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of users (without password hash).
   */
  public async getAllUsers(
    role?: Role,
    isActive?: boolean,
    search?: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Omit<User, "passwordHash">>> {
    const where: any = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          fullName: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const users = await paginate<Omit<User, "passwordHash">>(
      prisma.user,
      { page, limit },
      {
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    );
    return users;
  }

  /**
   * Finds a user by their ID.
   * @param userId The ID of the user to find.
   * @returns The user object (without password hash), or null if not found.
   */
  public async findUserById(
    userId: string,
  ): Promise<Omit<User, "passwordHash"> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  /**
   * Finds a user by their email.
   * @param email The email of the user to find.
   * @returns The user object (without password hash), or null if not found.
   */
  public async findUserByEmail(
    email: string,
  ): Promise<Omit<User, "passwordHash"> | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  /**
   * Creates a new user.
   * @param payload The data for the new user.
   * @returns The newly created user (without password hash).
   */
  public async createUser(
    payload: CreateUserPayload,
  ): Promise<Omit<User, "passwordHash">> {
    const { email, password, fullName, role, isActive } = payload;

    if (!email) {
      throw new AppError("Email is required", StatusCodes.BAD_REQUEST);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(
        "User with this email already exists",
        StatusCodes.CONFLICT,
      );
    }

    if (!password) {
      throw new AppError(
        "Password is required for new user creation",
        StatusCodes.BAD_REQUEST,
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: role || Role.USER,
        isActive: isActive !== undefined ? isActive : true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  /**
   * Updates an existing user.
   * @param id The ID of the user to update.
   * @param payload The data to update.
   * @returns The updated user (without password hash).
   */
  public async updateUser(
    id: string,
    payload: UpdateUserPayload,
  ): Promise<Omit<User, "passwordHash">> {
    const { password, ...dataToUpdate } = payload;

    if (password) {
      (dataToUpdate as any).passwordHash = await bcrypt.hash(password, 12);
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: dataToUpdate,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return user;
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("User not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a user.
   * @param id The ID of the user to delete.
   */
  public async deleteUser(id: string): Promise<void> {
    try {
      await prisma.user.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("User not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new UserService();
