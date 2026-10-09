import {prisma} from '../database/prisma';
import { AppError } from '../utils/errorHandler';
import { StatusCodes } from 'http-status-codes';
import { paginate } from '../utils/pagination';
import { Department } from '../../generated/prisma/client';
import { PaginatedResult } from "../types/pagination";

interface CreateDepartmentPayload {
  name: string;
  description?: string;
  openingHours?: string;
  location?: string;
  isActive?: boolean;
}

interface UpdateDepartmentPayload {
  name?: string;
  description?: string;
  openingHours?: string;
  location?: string;
  isActive?: boolean;
}

class DepartmentService {
  /**
   * Retrieves all departments with pagination.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of departments.
   */
  public async getAllDepartments(page?: number, limit?: number): Promise<PaginatedResult<Department>> {
    const departments = await paginate<Department>(
      prisma.department,
      { page, limit },
      {
        orderBy: { createdAt: 'desc' },
        include: {
          medicalServices: true,
          _count: {
            select: {
              doctors: true,
              medicalServices: true,
            },
          },
        },
      }
    );
    return departments;
  }

  /**
   * Retrieves a department by its ID.
   * @param id The ID of the department.
   * @returns The department, or null if not found.
   */
  public async getDepartmentById(id: string): Promise<Department | null> {
    return prisma.department.findUnique({
      where: { id },
      include: {
        doctors: true,
        medicalServices: true,
      },
    });
  }

  /**
   * Creates a new department.
   * @param payload The data for the new department.
   * @returns The newly created department.
   */
  public async createDepartment(payload: CreateDepartmentPayload): Promise<Department> {
    const { name, description, openingHours, location, isActive } = payload;
    return prisma.department.create({
      data: {
        name,
        description,
        openingHours,
        location,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
  }

  /**
   * Updates an existing department.
   * @param id The ID of the department to update.
   * @param payload The data to update.
   * @returns The updated department.
   */
  public async updateDepartment(id: string, payload: UpdateDepartmentPayload): Promise<Department> {
    try {
      const department = await prisma.department.update({
        where: { id },
        data: payload,
      });
      return department;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError('Department not found', StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a department.
   * @param id The ID of the department to delete.
   */
  public async deleteDepartment(id: string): Promise<void> {
    try {
      await prisma.department.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError('Department not found', StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new DepartmentService();
