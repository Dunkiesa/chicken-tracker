import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      email: string;
      role: string;
      name?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
