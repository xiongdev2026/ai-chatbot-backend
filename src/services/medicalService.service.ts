import { prisma } from "../database/prisma";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { paginate } from "../utils/pagination";
import { MedicalService } from "../../generated/prisma/client";
import { PaginatedResult } from "../types/pagination";

interface CreateMedicalServicePayload {
  name: string;
  description?: string;
  departmentId: string;
  isActive?: boolean;
}

interface UpdateMedicalServicePayload {
  name?: string;
  description?: string;
  departmentId?: string;
  isActive?: boolean;
}

class MedicalServiceService {
  /**
   * Retrieves all medical services, optionally filtered by department, with pagination.
   * @param departmentId Optional ID to filter medical services by department.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of medical services.
   */
  public async getAllMedicalServices(
    departmentId?: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<MedicalService>> {
    const where = departmentId ? { departmentId } : {};
    const services = await paginate<MedicalService>(
      prisma.medicalService,
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
    return services;
  }

  /**
   * Retrieves a medical service by its ID.
   * @param id The ID of the medical service.
   * @returns The medical service, or null if not found.
   */
  public async getMedicalServiceById(
    id: string,
  ): Promise<MedicalService | null> {
    return prisma.medicalService.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Creates a new medical service.
   * @param payload The data for the new medical service.
   * @returns The newly created medical service.
   */
  public async createMedicalService(
    payload: CreateMedicalServicePayload,
  ): Promise<MedicalService> {
    const { name, description, departmentId, isActive } = payload;
    return prisma.medicalService.create({
      data: {
        name,
        description,
        departmentId,
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
   * Updates an existing medical service.
   * @param id The ID of the medical service to update.
   * @param payload The data to update.
   * @returns The updated medical service.
   */
  public async updateMedicalService(
    id: string,
    payload: UpdateMedicalServicePayload,
  ): Promise<MedicalService> {
    try {
      const service = await prisma.medicalService.update({
        where: { id },
        data: payload,
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
      });
      return service;
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Medical service not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a medical service.
   * @param id The ID of the medical service to delete.
   */
  public async deleteMedicalService(id: string): Promise<void> {
    try {
      await prisma.medicalService.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Medical service not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new MedicalServiceService();
