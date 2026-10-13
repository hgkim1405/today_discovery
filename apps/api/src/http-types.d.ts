import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    principal: { id: string; role: "USER" | "CURATOR" | "ADMIN" } | null;
  }
}
