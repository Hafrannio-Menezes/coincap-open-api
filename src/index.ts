import { env } from "./config";
import { buildServer } from "./server";

async function bootstrap(): Promise<void> {
  const app = await buildServer();
  await app.listen({
    host: env.HOST,
    port: env.PORT
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
