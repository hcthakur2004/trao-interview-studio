import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { InputCase } from '../src/core/contracts';
import { PipelineError } from '../src/core/llm';
import { runPipeline } from '../src/core/pipeline';

const args = process.argv.slice(2);
const inputPath = args[args.indexOf('--input') + 1];
const outputPath = args[args.indexOf('--output') + 1];
if (!args.includes('--input') || !args.includes('--output') || !inputPath || !outputPath) {
  console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
  process.exit(1);
}
try {
  const inputs: unknown = JSON.parse(await readFile(inputPath, 'utf8'));
  if (!Array.isArray(inputs)) throw new Error('Input must be an array');
  const kits: unknown[] = [];
  for (const [index, item] of inputs.entries()) {
    const id = item && typeof item === 'object' && 'id' in item ? item.id : `invalid-${index}`;
    try {
      const input = InputCase.parse(item);
      const kit = await runPipeline(input, {
        allowLocal: process.env.EVALUATE_ALLOW_LOCAL !== 'false',
        onTrace: async (entry) => {
          console.error(`[${id}] ${entry.stage}: ${entry.message}`);
        },
      });
      kits.push({ id, status: 'ok', kit, error: null });
    } catch (error) {
      kits.push({
        id,
        status: 'failed',
        kit: null,
        error: {
          code:
            error instanceof PipelineError
              ? error.code
              : error instanceof Error && /timeout|aborted/i.test(error.message)
                ? 'TIME_BUDGET_EXCEEDED'
                : 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Unexpected failure',
        },
      });
    }
  }
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  const temp = `${outputPath}.${randomUUID()}.tmp`;
  await writeFile(
    temp,
    JSON.stringify({ version: '1.0', generated_at: new Date().toISOString(), kits }, null, 2),
  );
  await rename(temp, outputPath);
  console.error(`Wrote ${kits.length} results to ${outputPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
