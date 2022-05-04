/*
|--------------------------------------------------------------------------
| Ally Oauth driver
|--------------------------------------------------------------------------
|
| This is a dummy implementation of the Oauth driver. Make sure you
|
| - Got through every line of code
| - Read every comment
|
*/

import type { AllyUserContract } from '@ioc:Adonis/Addons/Ally'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Oauth2Driver, ApiRequest, RedirectRequest } from '@adonisjs/ally/build/standalone'

/**
 * Define the access token object properties in this type. It
 * must have "token" and "type" and you are free to add
 * more properties.
 */
export type RedditDriverAccessToken = {
  token: string
  secret: string
  type: 'bearer'
  expiresIn: number
  scope: string
  refreshToken: string
}
/**
 * Define a union of scopes your driver accepts. Here's an example of same
 * https://github.com/adonisjs/ally/blob/develop/adonis-typings/ally.ts#L236-L268
 */
export type RedditScopes =
  | 'account'
  | 'creddits'
  | 'edit'
  | 'flair'
  | 'history'
  | 'identity'
  | 'livemanage'
  | 'mysubreddits'
  | 'modconfig'
  | 'modcontributors'
  | 'modflair'
  | 'modlog'
  | 'modmail'
  | 'modothers'
  | 'modposts'
  | 'modself'
  | 'modtraffic'
  | 'modwiki'
  | 'privatemessages'
  | 'read'
  | 'report'
  | 'save'
  | 'structuredstyles'
  | 'submit'
  | 'subscribe'
  | 'vote'
  | 'wikiedit'
  | 'wikiread'

/**
 * Define the configuration options accepted by your driver. It must have the following
 * properties and you are free add more.
 */
export type RedditDriverConfig = {
  driver: 'reddit'
  scopes: Array<string>
  clientId: string
  clientSecret: string
  callbackUrl: string
  authorizeUrl?: string
  accessTokenUrl?: string
  userInfoUrl?: string
}

/**
 * Driver implementation. It is mostly configuration driven except the user calls
 */
export class RedditDriverContract extends Oauth2Driver<RedditDriverAccessToken, RedditScopes> {
  /**
   * The URL for the redirect request. The user will be redirected on this page
   * to authorize the request.
   *
   * Do not define query strings in this URL.
   */
  protected authorizeUrl = 'https://www.reddit.com/api/v1/authorize'

  /**
   * The URL to hit to exchange the authorization code for the access token
   *
   * Do not define query strings in this URL.
   */
  protected accessTokenUrl = 'https://www.reddit.com/api/v1/access_token'

  /**
   * The URL to hit to get the user details
   *
   * Do not define query strings in this URL.
   */
  protected userInfoUrl = 'https://oauth.reddit.com/api/v1/me'

  /**
   * The param name for the authorization code. Read the documentation of your oauth
   * provider and update the param name to match the query string field name in
   * which the oauth provider sends the authorization_code post redirect.
   */
  protected codeParamName = 'code'

  /**
   * The param name for the error. Read the documentation of your oauth provider and update
   * the param name to match the query string field name in which the oauth provider sends
   * the error post redirect
   */
  protected errorParamName = 'error'

  /**
   * Cookie name for storing the CSRF token. Make sure it is always unique. So a better
   * approach is to prefix the oauth provider name to `oauth_state` value. For example:
   * For example: "facebook_oauth_state"
   */
  protected stateCookieName = 'reddit_oauth_state'

  /**
   * Parameter name to be used for sending and receiving the state from.
   * Read the documentation of your oauth provider and update the param
   * name to match the query string used by the provider for exchanging
   * the state.
   */
  protected stateParamName = 'state'

  /**
   * Parameter name for sending the scopes to the oauth provider.
   */
  protected scopeParamName = 'scope'

  /**
   * The separator indentifier for defining multiple scopes
   */
  protected scopesSeparator = ' '

  constructor(ctx: HttpContextContract, public config: RedditDriverConfig) {
    super(ctx, config)

    /**
     * Extremely important to call the following method to clear the
     * state set by the redirect request.
     *
     * DO NOT REMOVE THE FOLLOWING LINE
     */
    this.loadState()
  }

  /**
   * Optionally configure the authorization redirect request. The actual request
   * is made by the base implementation of "Oauth2" driver and this is a
   * hook to pre-configure the request.
   */
  protected configureRedirectRequest(request: RedirectRequest<RedditScopes>) {
    /**
     * Define user defined scopes or the default one's
     */
    request.scopes(this.config.scopes || ['identity'])

    request.param('response_type', 'code')
    request.param('duration', 'temporary')
  }

  /**
   * Optionally configure the access token request. The actual request is made by
   * the base implementation of "Oauth2" driver and this is a hook to pre-configure
   * the request
   */
  protected configureAccessTokenRequest(request: ApiRequest) {
    /**
     * Send state to Reddit when request is not stateles
     */
    const buffer = Buffer.from(this.options.clientId + ':' + this.options.clientSecret)
    request.header('Authorization', 'Basic ' + buffer.toString('base64'))

    /**
     * Remove client_id and client_secret fields from body (included in header)
     */
    request.clearField('client_id')
    request.clearField('client_secret')

    if (!this.isStateless) {
      request.field('state', this.stateCookieValue)
    }
  }

  /**
   * Update the implementation to tell if the error received during redirect
   * means "ACCESS DENIED".
   */
  public accessDenied() {
    return this.ctx.request.input('error') === 'access_denied'
  }

  /**
   * Returns the HTTP request with the authorization header set
   */
  protected getAuthenticatedRequest(url: string, token: string) {
    const request = this.httpClient(url)
    request.header('Authorization', `bearer ${token}`)
    request.header('Accept', 'application/json')
    request.parseAs('json')
    return request
  }

  /**
   * Fetches the user info from the Reddit API
   * https://reddit.com/developers/docs/resources/user#get-current-user
   */
  protected async getUserInfo(token: string, callback?: (request: ApiRequest) => void) {
    const request = this.getAuthenticatedRequest(this.config.userInfoUrl || this.userInfoUrl, token)
    if (typeof callback === 'function') {
      callback(request)
    }

    const body = await request.get()
    return {
      id: body.id,
      name: body.name,
      nickName: '',
      avatarUrl: body.icon_img,
      email: null,
      emailVerificationState: body.verified ? ('verified' as const) : ('unverified' as const),
      original: body,
    }
  }

  /**
   * Get the user details by query the provider API. This method must return
   * the access token and the user details both. Checkout the google
   * implementation for same.
   *
   * https://github.com/adonisjs/ally/blob/develop/src/Drivers/Google/index.ts#L191-L199
   */
  public async user(callback?: (request: ApiRequest) => void): Promise<AllyUserContract<RedditDriverAccessToken>> {
    const token = await this.accessToken()
    const request = this.httpClient(this.config.userInfoUrl || this.userInfoUrl)

    /**
     * Allow end user to configure the request. This should be called after your custom
     * configuration, so that the user can override them (if required)
     */
    if (typeof callback === 'function') {
      callback(request)
    }

    /**
     * Write your implementation details here
     */
    const user = await this.getUserInfo(token.token, callback)

    return {
      ...user,
      token,
    }
  }

  public async userFromToken(
    token: string,
    callback?: (request: ApiRequest) => void
  ): Promise<AllyUserContract<{ token: string; type: 'bearer' }>> {
    const request = this.httpClient(this.config.userInfoUrl || this.userInfoUrl)

    /**
     * Allow end user to configure the request. This should be called after your custom
     * configuration, so that the user can override them (if required)
     */
    if (typeof callback === 'function') {
      callback(request)
    }

    /**
     * Write your implementation details here
     */
    const user = await this.getUserInfo(token, callback)

    return {
      ...user,
      token: { token, type: 'bearer' as const },
    }
  }
}
