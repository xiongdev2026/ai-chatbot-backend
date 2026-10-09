import { prisma } from "../database/prisma";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { paginate } from "../utils/pagination";
import { Service } from "../../generated/prisma/client";
import { PaginatedResult } from "../types/pagination";

interface CreateServicePayload {
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  category: string;
  isActive?: boolean;
  createdBy?: string;
}

interface UpdateServicePayload {
  name?: string;
  shortDescription?: string;
  fullDescription?: string;
  category?: string;
  isActive?: boolean;
}

class ServiceService {
  /**
   * Retrieves all services, optionally filtered by category and active status, with pagination.
   * @param category Optional category to filter services.
   * @param isActive Optional boolean to filter services by active status.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of services.
   */
  public async getAllServices(
    category?: string,
    isActive?: boolean,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Service>> {
    const where: any = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;

    const services = await paginate<Service>(
      prisma.service,
      { page, limit },
      {
        where,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
    );
    return services;
  }

  /**
   * Retrieves a service by its ID.
   * @param id The ID of the service.
   * @returns The service, or null if not found.
   */
  public async getServiceById(id: string): Promise<Service | null> {
    return prisma.service.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Creates a new service.
   * @param payload The data for the new service.
   * @returns The newly created service.
   */
  public async createService(payload: CreateServicePayload): Promise<Service> {
    const {
      name,
      shortDescription,
      fullDescription,
      category,
      isActive,
      createdBy,
    } = payload;
    return prisma.service.create({
      data: {
        name,
        shortDescription,
        fullDescription,
        category,
        isActive: isActive !== undefined ? isActive : true,
        createdBy,
      },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Updates an existing service.
   * @param id The ID of the service to update.
   * @param payload The data to update.
   * @returns The updated service.
   */
  public async updateService(
    id: string,
    payload: UpdateServicePayload,
  ): Promise<Service> {
    try {
      const service = await prisma.service.update({
        where: { id },
        data: payload,
        include: {
          creator: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
      return service;
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Service not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a service.
   * @param id The ID of the service to delete.
   */
  public async deleteService(id: string): Promise<void> {
    try {
      await prisma.service.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Service not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new ServiceService();
