import { Optional } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class DefaultSearchDTO {
    @ApiProperty()
    @Transform(({ value }) => +value)
    page?: number;

    @ApiProperty()
    @Transform(({ value }) => +value)
    limit?: number;

    @ApiProperty({description: "this is not required.", required: false})
    search?: string;
}