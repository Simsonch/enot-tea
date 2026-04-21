import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetProductsQueryDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 20;

    @IsOptional()
    @IsInt()
    @Min(0)
    offset = 0;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}