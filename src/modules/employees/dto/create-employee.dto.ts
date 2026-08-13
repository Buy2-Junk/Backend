import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import {
  Gender,
  JobType,
  PayoutPeriod,
  SalaryType,
} from "../../../generated/prisma/enums";

export class PersonalInfoDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsEnum(Gender)
  gender: Gender;
}

export class EmploymentDetailsDto {
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  seniorityLevel?: string;

  @IsOptional()
  @IsString()
  directManagerId?: string;

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualificationIds?: string[];
}

export class WorkWeekDto {
  @IsString()
  @IsNotEmpty()
  startDay: string;

  @IsString()
  @IsNotEmpty()
  endDay: string;
}

export class PayrollDetailsDto {
  @IsOptional()
  @IsEnum(SalaryType)
  salaryType?: SalaryType;

  @IsOptional()
  @IsEnum(PayoutPeriod)
  payoutPeriod?: PayoutPeriod;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkWeekDto)
  workWeek?: WorkWeekDto;
}

export class CreateEmployeeDto {
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmploymentDetailsDto)
  employmentDetails?: EmploymentDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayrollDetailsDto)
  payrollDetails?: PayrollDetailsDto;
}
