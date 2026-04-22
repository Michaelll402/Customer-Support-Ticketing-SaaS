export type EntityId = string;

export type Nullable<T> = T | null;

export interface ApiErrorPayload {
  code: string;
  message: string;
  path: string;
  statusCode: number;
  timestamp: string;
}

export interface HealthStatus {
  service: string;
  status: 'ok';
  timestamp: string;
}
