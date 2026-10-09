import { prisma } from "../database/prisma";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { paginate } from "../utils/pagination";
import { Doctor } from "../../generated/prisma/client";
import { PaginatedResult } from "../types/pagination";

interface CreateDoctorPayload {
  fullName: string;
  specialty: string;
  departmentId: string;
  bio?: string;
  isActive?: boolean;
}

interface UpdateDoctorPayload {
  fullName?: string;
  specialty?: string;
  departmentId?: string;
  bio?: string;
  isActive?: boolean;
}

class DoctorService {
  /**
   * Retrieves all doctors, optionally filtered by department, with pagination.
   * @param departmentId Optional ID to filter doctors by department.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of doctors.
   */
  public async getAllDoctors(
    departmentId?: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Doctor>> {
    const where = departmentId ? { departmentId } : {};
    const doctors = await paginate<Doctor>(
      prisma.doctor,
      { page, limit },
      {
        where,
        orderBy: { createdAt: "desc" },
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
      },
    );
    return doctors;
  }

  /**
   * Retrieves a doctor by their ID.
   * @param id The ID of the doctor.
   * @returns The doctor, or null if not found.
   */
  public async getDoctorById(id: string): Promise<Doctor | null> {
    return prisma.doctor.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Creates a new doctor.
   * @param payload The data for the new doctor.
   * @returns The newly created doctor.
   */
  public async createDoctor(payload: CreateDoctorPayload): Promise<Doctor> {
    const { fullName, specialty, departmentId, bio, isActive } = payload;
    return prisma.doctor.create({
      data: {
        fullName,
        specialty,
        departmentId,
        bio,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Updates an existing doctor.
   * @param id The ID of the doctor to update.
   * @param payload The data to update.
   * @returns The updated doctor.
   */
  public async updateDoctor(
    id: string,
    payload: UpdateDoctorPayload,
  ): Promise<Doctor> {
    try {
      const doctor = await prisma.doctor.update({
        where: { id },
        data: payload,
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
      });
      return doctor;
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Doctor not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a doctor.
   * @param id The ID of the doctor to delete.
   */
  public async deleteDoctor(id: string): Promise<void> {
    try {
      await prisma.doctor.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Doctor not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new DoctorService();
