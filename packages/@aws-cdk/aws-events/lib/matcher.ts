/**
 * Event Pattern matcher.
 */
export abstract class Matcher {

    /**
     * Matches event based attribute value.
     * @param values possible values to match the event attribute against
     */
    public static match(...values: string[]): any[] {
        return values;
    }

    /**
     * Matches event based on attribute value prefix.
     * @param value the prefix value to match the event attribute against
     */
    public static matchPrefix(value: string): any[] {
        return [{prefix: value}];
    }

    /**
     * Matches event based on excluded attribute values.
     * @param values the event attribute values being excluded from match
     */
    public static matchAnythingBut(...values: string[]): any[] {
        return [{"anything-but": values}];
    }

    /**
     * Matches event based on excluded attribute value prefix.
     * @param value the event attribute prefix being excluded from match
     */
    public static matchAnythingButPrefix(value: string): any[] {
        return [{"anything-but": {prefix: value}}];
    }

    /**
     * Matches event based on CIDR value i.e. '10.0.0.0/24'.
     * @param value the CIDR value to match event against
     */
    public static matchCidr(value: string): any[] {
        return [{cidr: value}];
    }

    /**
     * Matches event based on presence or absence of attribute.
     * @param value whether the attribute should exist or not
     */
    public static matchExists(value: boolean): any[] {
        return [{exists: value}];
    }
}