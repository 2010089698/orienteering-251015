export interface PublicProjectionCdnClient {
  purgePaths(paths: string[]): Promise<void>;
}

export interface HttpPublicProjectionCdnClientOptions {
  endpoint: string;
  authorizationToken?: string;
}

export class HttpPublicProjectionCdnClient implements PublicProjectionCdnClient {
  private readonly endpoint: string;
  private readonly authorizationToken?: string;

  constructor(options: HttpPublicProjectionCdnClientOptions) {
    this.endpoint = options.endpoint;
    this.authorizationToken = options.authorizationToken;
  }

  async purgePaths(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.authorizationToken ? { authorization: `Bearer ${this.authorizationToken}` } : {}),
      },
      body: JSON.stringify({ paths }),
    });

    if (!response.ok) {
      throw new Error(`Failed to purge CDN cache: ${response.status} ${response.statusText}`);
    }
  }
}
