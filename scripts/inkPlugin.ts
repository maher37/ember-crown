import { Compiler } from 'inkjs/compiler/Compiler';
import type { Plugin } from 'vite';

/**
 * Compiles Ink dialogue scripts (src/content/dialogue/*.ink) to story JSON at build time, so
 * `import story from './tavern.ink'` gives the compiled story. Ink errors fail the build.
 */
export function inkPlugin(): Plugin {
  return {
    name: 'ember-crown-ink',
    transform(code, id) {
      if (!id.endsWith('.ink')) return null;
      const compiler = new Compiler(code);
      let json: string;
      try {
        json = compiler.Compile().ToJson() ?? '';
      } catch (e) {
        const errors = compiler.errors.length ? compiler.errors.join('\n') : String(e);
        throw new Error(`Ink errors in ${id}:\n${errors}`, { cause: e });
      }
      if (compiler.errors.length)
        throw new Error(`Ink errors in ${id}:\n${compiler.errors.join('\n')}`);
      for (const w of compiler.warnings) this.warn(`${id}: ${w}`);
      return { code: `export default ${JSON.stringify(json)};`, map: null };
    },
  };
}
