export type AuthenticatedOwner = {
  id: string;
  email: string;
};

export type OwnerJwtPayload = {
  sub: string;
  email: string;
  roles: string[];
};
