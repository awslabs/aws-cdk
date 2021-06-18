/**
 * Controls the countries in which content is distributed.
 */
export class GeoRestriction {
  /**
   * Allow specific countries which you want CloudFront to distribute your content.
   *
   * @param locations Two-letter, uppercase country code for a country
   * that you want to allow. Include one element for each country.
   * See ISO 3166-1-alpha-2 code on the *International Organization for Standardization* website
   */
  public static allowlist(...locations: string[]) {
    return new GeoRestriction('whitelist', GeoRestriction.validateLocations(locations));
  }

  /**
   * Deny specific countries which you don't want CloudFront to distribute your content.
   *
   * @param locations Two-letter, uppercase country code for a country
   * that you want to deny. Include one element for each country.
   * See ISO 3166-1-alpha-2 code on the *International Organization for Standardization* website
   */
  public static denylist(...locations: string[]) {
    return new GeoRestriction('blacklist', GeoRestriction.validateLocations(locations));
  }

  /**
   * DEPRECATED
   * @deprecated use `allowlist`
   */
  public static whitelist(...locations: string[]) {
    return GeoRestriction.allowlist(...locations);
  }

  /**
   * DEPRECATED
   * @deprecated use `denylist`
   */
  public static blacklist(...locations: string[]) {
    return GeoRestriction.denylist(...locations);
  }

  private static LOCATION_REGEX = /^[A-Z]{2}$/;

  private static validateLocations(locations: string[]) {
    if (locations.length === 0) {
      throw new Error('Should provide at least 1 location');
    }
    locations.forEach(location => {
      if (!GeoRestriction.LOCATION_REGEX.test(location)) {
        // eslint-disable-next-line max-len
        throw new Error(`Invalid location format for location: ${location}, location should be two-letter and uppercase country ISO 3166-1-alpha-2 code`);
      }
    });
    return locations;
  }

  /**
   * Creates an instance of GeoRestriction for internal use
   *
   * @param restrictionType Specifies the restriction type to impose
   * @param locations Two-letter, uppercase country code for a country
   * that you want to allow/deny. Include one element for each country.
   * See ISO 3166-1-alpha-2 code on the *International Organization for Standardization* website
   */
  private constructor(readonly restrictionType: 'whitelist' | 'blacklist', readonly locations: string[]) {}
}
