import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class RedditDriverProvider {
  constructor(protected app: ApplicationContract) {}

  public async boot() {
    const Ally = this.app.container.resolveBinding('Adonis/Addons/Ally')
    const { RedditDriverContract } = await import('../src/RedditDriver')

    Ally.extend('reddit', (_, __, config, ctx) => {
      return new RedditDriverContract(ctx, config)
    })
  }
}
