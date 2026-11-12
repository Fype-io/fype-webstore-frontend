import { describe, it, expect } from "vitest";
import { readWranglerConfig, type EnvConfig } from "./helpers/wrangler-config";

// open-next.config.ts uses OpenNext's R2 incremental cache, which reads this
// exact binding name. Without it every cache read and write fails (logged,
// treated as a miss) and pages fetch everything from the API again. Bindings
// aren't inherited by wrangler environments, so each must declare its own.
const BINDING = "NEXT_INC_CACHE_R2_BUCKET";
const config = readWranglerConfig();

function cacheBucket(env: EnvConfig): string | undefined {
    return env.r2_buckets?.find((bucket) => bucket.binding === BINDING)?.bucket_name;
}

describe("wrangler.jsonc fetch-cache R2 bucket", () => {
    const environments: [string, EnvConfig][] = [["production (top level)", config], ...Object.entries(config.env ?? {})];

    it.each(environments)("%s binds a bucket as NEXT_INC_CACHE_R2_BUCKET", (_name, env) => {
        expect(cacheBucket(env)).toMatch(/\S/);
    });

    it("staging never shares production's bucket", () => {
        expect(cacheBucket(config.env?.staging ?? {})).not.toBe(cacheBucket(config));
    });
});
