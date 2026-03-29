/**
 * Template variable interpolation using {{variable}} syntax.
 */

export class InterpolationError extends Error {
  constructor(
    public readonly variable: string,
    template: string,
  ) {
    super(`Unresolved variable "{{${variable}}}" in template: ${template.slice(0, 80)}`);
    this.name = 'InterpolationError';
  }
}

/**
 * Pattern for {{varName}} where varName is alphanumeric, dots, or underscores.
 */
const VAR_PATTERN = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

/**
 * Replace all {{variable}} placeholders in a template string with values from
 * the provided record. Throws InterpolationError for any unresolved variables.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(VAR_PATTERN, (_match, varName: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, varName)) {
      return vars[varName];
    }
    throw new InterpolationError(varName, template);
  });
}
