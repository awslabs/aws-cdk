import { Token } from "./token";

/**
 * Represents the amount of digital storage.
 *
 * The amount can be specified either as a literal value (e.g: `10`) which
 * cannot be negative, or as an unresolved number token.
 *
 * When the amount is passed as a token, unit conversion is not possible.
 */
export class Storage {
  /**
   * Create a Storage representing an amount kibibytes.
   */
  public static kibibytes(amount: number): Storage {
    return new Storage(amount, StorageUnit.Kibibytes);
  }

  /**
   * Create a Storage representing an amount mebibytes.
   */
  public static mebibytes(amount: number): Storage {
    return new Storage(amount, StorageUnit.Mebibytes);
  }

  /**
   * Create a Storage representing an amount mebibytes.
   */
  public static gibibytes(amount: number): Storage {
    return new Storage(amount, StorageUnit.Gibibytes);
  }

  /**
   * Create a Storage representing an amount tebibytes.
   */
  public static tebibytes(amount: number): Storage {
    return new Storage(amount, StorageUnit.Tebibytes);
  }

  /**
   * Create a Storage representing an amount pebibytes.
   */
  public static pebibyte(amount: number): Storage {
    return new Storage(amount, StorageUnit.Pebibytes);
  }

  private readonly amount: number;
  private readonly unit: StorageUnit;

  private constructor(amount: number, unit: StorageUnit) {
    if (!Token.isUnresolved(amount) && amount < 0) {
      throw new Error(`Storage amounts cannot be negative. Received: ${amount}`);
    }
    this.amount = amount;
    this.unit = unit;
  }

  /**
   * Return this storage as a total number of kibibytes.
   */
  public toKibibytes(opts: StorageConversionOptions = {}): number {
    return convert(this.amount, this.unit, StorageUnit.Kibibytes, opts);
  }

  /**
   * Return this storage as a total number of mebibytes.
   */
  public toMebibytes(opts: StorageConversionOptions = {}): number {
    return convert(this.amount, this.unit, StorageUnit.Mebibytes, opts);
  }

  /**
   * Return this storage as a total number of gibibytes.
   */
  public toGibibytes(opts: StorageConversionOptions = {}): number {
    return convert(this.amount, this.unit, StorageUnit.Gibibytes, opts);
  }

  /**
   * Return this storage as a total number of tebibytes.
   */
  public toTebibytes(opts: StorageConversionOptions = {}): number {
    return convert(this.amount, this.unit, StorageUnit.Tebibytes, opts);
  }

  /**
   * Return this storage as a total number of pebibytes.
   */
  public toPebibytes(opts: StorageConversionOptions = {}): number {
    return convert(this.amount, this.unit, StorageUnit.Pebibytes, opts);
  }
}

/**
 * Options for how to convert time to a different unit.
 */
export interface StorageConversionOptions {
  /**
   * If `true`, conversions into a larger storage units (e.g. `Kibibytes` to `Mebibytes`) will fail if the result is not
   * an integer.
   * @default true
   */
  readonly integral?: boolean;
}

class StorageUnit {
  public static readonly Kibibytes = new StorageUnit('kibibytes', 1);
  public static readonly Mebibytes = new StorageUnit('mebibytes', 1024);
  public static readonly Gibibytes = new StorageUnit('gibibytes', 1024 * 1024);
  public static readonly Tebibytes = new StorageUnit('tebibytes', 1024 * 1024 * 1024);
  public static readonly Pebibytes = new StorageUnit('pebibytes', 1024 * 1024 * 1024 * 1024);

  private constructor(public readonly label: string, public readonly inKibiBytes: number) {
    // MAX_SAFE_INTEGER is 2^53, so by representing storage in kibibytes,
    // the highest storage we can represent is 8 exbibytes.
  }

  public toString() {
    return this.label;
  }
}

function convert(amount: number, fromUnit: StorageUnit, toUnit: StorageUnit, { integral = true }: StorageConversionOptions) {
  if (fromUnit.inKibiBytes === toUnit.inKibiBytes) { return amount; }
  if (Token.isUnresolved(amount)) {
    throw new Error(`Unable to perform time unit conversion on un-resolved token ${amount}.`);
  }

  const multiplier = fromUnit.inKibiBytes / toUnit.inKibiBytes;
  const value = amount * multiplier;
  if (!Number.isInteger(value) && integral) {
    throw new Error(`'${amount} ${fromUnit}' cannot be converted into a whole number of ${toUnit}.`);
  }
  return value;
}
