import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcryptjs";
import { signToken, JwtPayload } from "../utils/jwt";
import { User } from "../../generated/prisma/client";
import { prisma } from "../database/prisma";

interface RegisterUserPayload {
  email: string;
  password: string;
  fullName?: string;
}

interface LoginUserPayload {
  email: string;
  password: string;
}

class AuthService {
  /**
   * Registers a new user.
   * @param payload User registration data.
   * @returns The newly created user (without password hash) and a JWT token.
   */
  public async register(
    payload: RegisterUserPayload,
  ): Promise<{ user: Omit<User, "passwordHash">; token: string }> {
    const { email, password, fullName } = payload;

    // 1) Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError(
        "User with this email already exists.",
        StatusCodes.CONFLICT,
      );
    }

    // 2) Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 3) Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName,
        role: "USER", // Hardcoded to prevent privilege escalation
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

    // 4) Generate JWT token
    const jwtPayload: JwtPayload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
    const token = signToken(jwtPayload);

    return { user: newUser, token };
  }

  /**
   * Logs in a user.
   * @param payload User login data.
   * @returns The logged-in user (without password hash) and a JWT token.
   */
  public async login(
    payload: LoginUserPayload,
  ): Promise<{ user: Omit<User, "passwordHash">; token: string }> {
    const { email, password } = payload;

    // 1) Check if user exists and password is correct
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(
        "Incorrect email or password.",
        StatusCodes.UNAUTHORIZED,
      );
    }

    // 2) Generate JWT token
    const jwtPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const token = signToken(jwtPayload);

    // 3) Return user (without password hash) and token
    const { passwordHash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }
}

export default new AuthService();
