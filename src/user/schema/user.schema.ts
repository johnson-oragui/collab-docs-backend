
export interface UserSchema {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  password?: string;
  acceptTerms: boolean;
  createdAt: Date;
  updatedAt: Date;
}
