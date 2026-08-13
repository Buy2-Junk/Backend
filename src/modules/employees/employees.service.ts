import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Employee, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";

const DEFAULT_EMPLOYEE_ROLE = "Employee";

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(dto: CreateEmployeeDto) {
    const { personalInfo, employmentDetails, payrollDetails } = dto;

    const existing = await this.prisma.employee.findUnique({
      where: { email: personalInfo.email },
    });
    if (existing) {
      throw new ConflictException(
        `Email ${personalInfo.email} is already in use.`,
      );
    }

    if (employmentDetails?.directManagerId) {
      const manager = await this.prisma.employee.findUnique({
        where: { id: employmentDetails.directManagerId },
      });
      if (!manager) {
        throw new BadRequestException(
          "directManagerId does not reference an existing employee.",
        );
      }
    }

    const role = await this.prisma.role.upsert({
      where: { name: DEFAULT_EMPLOYEE_ROLE },
      update: {},
      create: { name: DEFAULT_EMPLOYEE_ROLE, permissions: {} },
    });

    const employee = await this.prisma.employee.create({
      data: {
        email: personalInfo.email,
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        phoneNumber: personalInfo.phoneNumber,
        gender: personalInfo.gender,
        roleId: role.id,
        jobTitle: employmentDetails?.jobTitle ?? null,
        department: employmentDetails?.department ?? null,
        seniorityLevel: employmentDetails?.seniorityLevel ?? null,
        jobType: employmentDetails?.jobType ?? null,
        directManagerId: employmentDetails?.directManagerId ?? null,
        qualificationIds: (employmentDetails?.qualificationIds ??
          null) as unknown as Prisma.InputJsonValue,
        salaryType: payrollDetails?.salaryType ?? null,
        payoutPeriod: payrollDetails?.payoutPeriod ?? null,
        workWeek: (payrollDetails?.workWeek ??
          null) as unknown as Prisma.InputJsonValue,
      },
    });

    const setupToken = await this.authService.signSetupToken(employee.id);

    return { employee: this.toSafeEmployee(employee), setupToken };
  }

  private toSafeEmployee(employee: Employee): Omit<Employee, "passwordHash"> {
    const { passwordHash, ...safe } = employee;
    void passwordHash;
    return safe;
  }
}
