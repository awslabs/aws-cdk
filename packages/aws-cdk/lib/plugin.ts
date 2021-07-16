import { green } from 'colors/safe';

import { CredentialProviderSource } from './api/aws-auth/credentials';
import { error } from './logging';
import { Configuration } from './settings';

/**
 * The basic contract for plug-ins to adhere to::
 *
 *   import { Configuration, Plugin, PluginHost } from 'aws-cdk';
 *   import { CustomCredentialProviderSource } from './custom-credential-provider-source';
 *
 *   export default class FooCDKPlugIn implements PluginHost {
 *     public readonly version = '1';
 *
 *     public init(host: PluginHost, config: Configuration) {
 *       host.registerCredentialProviderSource(new CustomCredentialProviderSource(config));
 *     }
 *   }
 *
 */
export interface Plugin {
  /**
   * The version of the plug-in interface used by the plug-in. This will be used by
   * the plug-in host to handle version changes.
   */
  version: '1';

  /**
   * When defined, this function is invoked right after the plug-in has been loaded,
   * so that the plug-in is able to initialize itself. It may call methods of the
   * ``PluginHost`` instance it receives to register new ``CredentialProviderSource``
   * instances.
   */
  init?: (host: PluginHost, config: Configuration) => void;
}

/**
 * A utility to manage plug-ins.
 *
 */
export class PluginHost {
  public static instance = new PluginHost();

  /**
   * Access the currently registered CredentialProviderSources. New sources can
   * be registered using the +registerCredentialProviderSource+ method.
   */
  public readonly credentialProviderSources = new Array<CredentialProviderSource>();

  constructor() {
    if (PluginHost.instance && PluginHost.instance !== this) {
      throw new Error('New instances of PluginHost must not be built. Use PluginHost.instance instead!');
    }
  }

  /**
   * Loads a plug-in into this PluginHost.
   *
   * @param moduleSpec the specification (path or name) of the plug-in module to be loaded.
   */
  public load(moduleSpec: string, config: Configuration) {
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const plugin = require(moduleSpec);
      /* eslint-enable */
      if (!isPlugin(plugin)) {
        error(`Module ${green(moduleSpec)} is not a valid plug-in, or has an unsupported version.`);
        throw new Error(`Module ${moduleSpec} does not define a valid plug-in.`);
      }
      if (plugin.init) { plugin.init(PluginHost.instance, config); }
    } catch (e) {
      error(`Unable to load ${green(moduleSpec)}: ${e.stack}`);
      throw new Error(`Unable to load plug-in: ${moduleSpec}`);
    }

    function isPlugin(x: any): x is Plugin {
      return x != null && x.version === '1';
    }
  }

  /**
   * Allows plug-ins to register new CredentialProviderSources.
   *
   * @param source a new CredentialProviderSource to register.
   */
  public registerCredentialProviderSource(source: CredentialProviderSource) {
    this.credentialProviderSources.push(source);
  }
}
