import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/** Coerce form-encoded string to number (e.g. "4" -> 4). */
function toNumber(value: unknown): number | unknown {
  if (value === '' || value == null) return value;
  const n = Number(value);
  return Number.isNaN(n) ? value : n;
}

export class GetBalanceBodyDto {
  @IsNumber()
  productType: number;

  @IsNumber()
  gameType: number;

  @IsOptional()
  @IsNumber()
  gpid?: number;
}

export class DeductBodyDto {
  @IsNumber()
  amount: number;

  @IsString()
  transferCode: string;

  @IsString()
  transactionId: string;

  @IsOptional()
  betInfo?: Record<string, unknown>[];

  @IsString()
  betTime: string;

  @IsNumber()
  productType: number;

  @IsNumber()
  gameType: number;

  @IsOptional()
  @IsString()
  gameRoundId?: string;

  @IsOptional()
  @IsString()
  gamePeriodId?: string;

  @IsOptional()
  @IsString()
  orderDetail?: string;

  @IsOptional()
  @IsString()
  playerIp?: string;

  @IsOptional()
  @IsString()
  gameTypeName?: string;

  @IsOptional()
  @IsNumber()
  newGameType?: number;

  @IsOptional()
  @IsNumber()
  gameId?: number;

  @IsOptional()
  @IsNumber()
  gpid?: number;

  @IsOptional()
  extraInfo?: Record<string, unknown>;

  @IsOptional()
  seamlessGameExtraInfo?: Record<string, unknown>;
}

export class SettleBodyDto {
  @IsString()
  transferCode: string;

  @IsNumber()
  winLoss: number;

  @IsNumber()
  resultType: number;

  @IsString()
  resultTime: string;

  @IsNumber()
  commissionStake: number;

  @IsString()
  gameResult: string;

  @IsNumber()
  productType: number;

  @IsNumber()
  gameType: number;

  @IsBoolean()
  isCashOut: boolean;

  @IsOptional()
  @IsNumber()
  gpid?: number;

  @IsOptional()
  extraInfo?: Record<string, unknown>;

  @IsOptional()
  seamlessGameExtraInfo?: Record<string, unknown>;
}

export class RollbackBodyDto {
  @IsString()
  transferCode: string;

  @IsNumber()
  productType: number;

  @IsNumber()
  gameType: number;

  @IsOptional()
  @IsNumber()
  gpid?: number;

  @IsOptional()
  extraInfo?: Record<string, unknown>;
}

export class CancelBodyDto {
  @IsString()
  transferCode: string;

  @IsNumber()
  productType: number;

  @IsNumber()
  gameType: number;

  @IsBoolean()
  isCancelAll: boolean;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsNumber()
  gpid?: number;

  @IsOptional()
  extraInfo?: Record<string, unknown>;
}

/** GetTickets request body. ItemList can be JSON array or form-encoded (ItemList[0][Type], etc.). */
export class GetTicketsBodyDto {
  @IsOptional()
  ItemList?: Record<string, unknown>[] | Record<number, Record<string, unknown>>;

  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  lastReq: number;

  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  OddsType: number;

  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  WebSkinType: number;

  @IsString()
  LicUserName: string;
}

/** ProcessBet request body. ItemList contains bet legs (Type, Bettype, Oddsid, Stake, Matchid, etc.). */
export class ProcessBetBodyDto {
  @IsOptional()
  ItemList?: Record<string, unknown>[] | Record<number, Record<string, unknown>>;

  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  OddsType: number;

  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  WebSkinType: number;

  @IsString()
  LicUserName: string;
}
